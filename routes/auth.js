import express from 'express'
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import {body, validationResult} from 'express-validator'

const router = express.Router()

// Authentication Middleware
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    req.session.error = 'Please login to access this page'
    return res.redirect('/login')
  }
  next()
}

const redirectIfAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return res.redirect('/dashboard')
  }
  next()
}

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'hrant',
  database: 'fitness',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

router.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard')
  }
  res.render('login', {title: 'Login', error: null, user: null})
})

router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard')
  }

  const success = req.session.success
  if (req.session.success) {
    delete req.session.success
  }

  res.render('login', {
    title: 'Login',
    error: null,
    user: null,
    success: success
  })
})

router.post('/login', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.render('login', {title: 'Login', error: errors.array()[0].msg, user: null})
  }

  try {
    const [rows] = await pool.execute('select * from users where username = ?', [req.body.username])

    if (rows.length === 0) {
      return res.render('login', {title: 'Login', error: 'Invalid username or password', user: null})
    }

    const user = rows[0]
    const isMatch = await bcrypt.compare(req.body.password, user.password)

    if (!isMatch) {
      return res.render('login', {title: 'Login', error: 'Invalid username or password', user: null})
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email
    }

    const [profile] = await pool.execute('select * from user_info where user_id = ?', [user.id])

    if (profile.length === 0) {
      return res.redirect('/user-info')
    }

    res.redirect('/dashboard')
  } catch (err) {
    console.error(err)
    res.render('login', {title: 'Login', error: 'Server error', user: null})
  }
})


router.post('/signup', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({min: 6}).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.render('signup', {
      title: 'Sign Up',
      error: errors.array()[0].msg,
      success: null,
      user: null
    })
  }

  try {
    const [existing] = await pool.execute(
      'select * from users where username = ? or email = ?',
      [req.body.username, req.body.email]
    )

    if (existing.length > 0) {
      return res.render('signup', {
        title: 'Sign Up',
        error: 'Username or email already exists',
        success: null,
        user: null
      })
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10)

    await pool.execute(
      'insert into users (username, email, password) values (?, ?, ?)',
      [req.body.username, req.body.email, hashedPassword]
    )

    return res.render('signup', {
      title: 'Sign Up',
      error: null,
      success: 'Signup successful! Redirecting to login...',
      user: null
    })
  } catch (err) {
    console.error(err)
    res.render('signup', {
      title: 'Sign Up',
      error: 'Registration failed',
      success: null,
      user: null
    })
  }
})
router.get('/signup', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard')
  }
  res.render('signup', {
    title: 'Sign Up',
    error: null,
    success: null,
    user: null
  })
})


router.post('/user-info', requireAuth, [
  body('height').isInt({min: 50, max: 250}).withMessage('Height must be between 50-250 cm'),
  body('weight').isFloat({min: 30, max: 300}).withMessage('Weight must be between 30-300 kg'),
  body('age').isInt({min: 13, max: 120}).withMessage('Age must be between 13-120'),
  body('goal').isIn(['weight_loss', 'muscle_gain', 'maintenance']).withMessage('Invalid goal selected')
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.render('user-info', {
      title: 'Complete Your Profile',
      error: errors.array()[0].msg,
      profile: req.body
    })
  }

  try {
    const {height, weight, age, goal} = req.body
    const userId = req.session.user.id

    // Check if profile exists
    const [existing] = await pool.execute(
      'SELECT 1 FROM user_info WHERE user_id = ?',
      [userId]
    )

    if (existing.length > 0) {
      await pool.execute(
        'UPDATE user_info SET height = ?, weight = ?, age = ?, goal = ? WHERE user_id = ?',
        [height, weight, age, goal, userId]
      )
    } else {
      await pool.execute(
        'INSERT INTO user_info (user_id, height, weight, age, goal) VALUES (?, ?, ?, ?, ?)',
        [userId, height, weight, age, goal]
      )
    }

    // After saving profile, redirect to training plan instead of dashboard
    res.redirect('/training-plan')

  } catch (err) {
    console.error(err)
    res.render('user-info', {
      title: 'Complete Your Profile',
      error: 'Failed to save your information. Please try again.',
      profile: req.body
    })
  }
})


router.get('/user-info', requireAuth, async (req, res) => {
  try {
    // Check if profile already exists
    const [profile] = await pool.execute(
      'SELECT * FROM user_info WHERE user_id = ?',
      [req.session.user.id]
    )

    res.render('user-info', {
      title: 'Complete Your Profile',
      error: null,
      // Pass existing profile data if available
      profile: profile.length ? profile[0] : null
    })
  } catch (err) {
    console.error(err)
    req.session.error = 'Error loading profile form'
    res.redirect('/dashboard')
  }
})
// GET update-profile page
router.get('/update-profile', requireAuth, async (req, res) => {
  try {
    // Get user's profile information
    const [profile] = await pool.execute(
      'SELECT age, height, weight, goal FROM user_info WHERE user_id = ?',
      [req.session.user.id]
    )

    if (!profile.length) {
      req.session.error = 'Please complete your profile first'
      return res.redirect('/user-info')
    }

    res.render('update-profile', {
      title: 'Update Profile',
      user: req.session.user,
      profile: profile[0], // Make sure to pass the first profile record
      error: null
    })

  } catch (err) {
    console.error(err)
    req.session.error = 'Error loading profile update form'
    res.redirect('/dashboard')
  }
})

// Add this to your auth.js
router.get('/training-plan', requireAuth, async (req, res) => {
  try {
    // Get user's profile
    const [profileRows] = await pool.execute(
      'SELECT age, goal FROM user_info WHERE user_id = ?',
      [req.session.user.id]
    )

    if (!profileRows.length) {
      req.session.error = 'Please complete your profile first'
      return res.redirect('/user-info')
    }

    const profile = profileRows[0]
    let ageGroup = 'adult'

    // Determine age group
    if (profile.age < 18) ageGroup = 'teen'
    else if (profile.age > 45) ageGroup = 'senior'

    // Get appropriate training plan
    const [plans] = await pool.execute(
      'SELECT * FROM training_plans WHERE goal = ? AND age_group = ?',
      ['weight_loss', ageGroup]
    )

    if (!plans.length) {
      req.session.error = 'No training plan available for your profile'
      return res.redirect('/dashboard')
    }

    res.render('training-plan', {
      title: 'Your Training Plan',
      user: req.session.user,
      plan: plans[0],
      profile
    })

  } catch (err) {
    console.error('Training plan error:', err)
    req.session.error = 'Error loading training plan'
    res.redirect('/dashboard')
  }
})

// POST updated profile
router.post('/update-profile', requireAuth, [
  body('height').isInt({min: 50, max: 250}).withMessage('Height must be between 50-250 cm'),
  body('weight').isFloat({min: 30, max: 300}).withMessage('Weight must be between 30-300 kg'),
  body('age').isInt({min: 13, max: 120}).withMessage('Age must be between 13-120'),
  body('goal').isIn(['weight_loss', 'muscle_gain', 'maintenance']).withMessage('Invalid goal selected')
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.render('update-profile', {
      title: 'Update Profile',
      user: req.session.user,
      profile: req.body, // Pass back the submitted values
      error: errors.array()[0].msg
    })
  }

  try {
    const {height, weight, age, goal} = req.body
    await pool.execute(
      'UPDATE user_info SET height = ?, weight = ?, age = ?, goal = ? WHERE user_id = ?',
      [height, weight, age, goal, req.session.user.id]
    )

    req.session.success = 'Profile updated successfully!'
    res.redirect('/dashboard')

  } catch (err) {
    console.error(err)
    res.render('update-profile', {
      title: 'Update Profile',
      user: req.session.user,
      profile: req.body,
      error: 'Failed to update profile. Please try again.'
    })
  }
})


router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const [profile] = await pool.execute(
      'SELECT * FROM user_info WHERE user_id = ?',
      [req.session.user.id]
    )

    if (!profile.length) {
      req.session.error = 'Please complete your profile first'
      return res.redirect('/user-info')
    }

    // Get training plan based on profile
    let ageGroup = 'adult'
    if (profile[0].age < 18) ageGroup = 'teen'
    else if (profile[0].age > 45) ageGroup = 'senior'

    const [trainingPlan] = await pool.execute(
      'SELECT * FROM training_plans WHERE goal = ? AND age_group = ? LIMIT 1',
      [profile[0].goal, ageGroup]
    )

    res.render('dashboard', {
      title: 'Dashboard',
      user: req.session.user,
      profile: profile[0],
      trainingPlan: trainingPlan[0] || null // Ensure we pass null if no plan exists
    })

  } catch (err) {
    console.error(err)
    req.session.error = 'Error loading dashboard'
    res.redirect('/login')
  }
})


router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error(err)
    }
    res.redirect('/login')
  })
})

export default router
