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

// Helper function to get age group
const getAgeGroup = (age) => {
  if (age < 18) return 'teen'
  if (age > 45) return 'senior'
  return 'adult'
}

// Helper function to get user profile
const getUserProfile = async (userId) => {
  const [profile] = await pool.execute(
    'SELECT * FROM user_info WHERE user_id = ?',
    [userId]
  )
  return profile.length ? profile[0] : null
}

// Routes
router.get('/', redirectIfAuthenticated, (req, res) => {
  res.render('login', {
    title: 'Login',
    error: null,
    user: null
  })
})

router.get('/login', redirectIfAuthenticated, (req, res) => {
  const success = req.session.success
  delete req.session.success

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
    return res.render('login', {
      title: 'Login',
      error: errors.array()[0].msg,
      user: null
    })
  }

  try {
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE username = ?',
      [req.body.username]
    )

    if (users.length === 0) {
      return res.render('login', {
        title: 'Login',
        error: 'Invalid username or password',
        user: null
      })
    }

    const user = users[0]
    const isMatch = await bcrypt.compare(req.body.password, user.password)

    if (!isMatch) {
      return res.render('login', {
        title: 'Login',
        error: 'Invalid username or password',
        user: null
      })
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email
    }

    const profile = await getUserProfile(user.id)
    return profile ? res.redirect('/dashboard') : res.redirect('/user-info')

  } catch (err) {
    console.error('Login error:', err)
    res.render('login', {
      title: 'Login',
      error: 'Server error',
      user: null
    })
  }
})

// Signup Routes
router.get('/signup', redirectIfAuthenticated, (req, res) => {
  res.render('signup', {
    title: 'Sign Up',
    error: null,
    success: null,
    user: null
  })
})

router.post('/signup', [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({min: 3}).withMessage('Username must be at least 3 characters'),
  body('email')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .isLength({min: 6}).withMessage('Password must be at least 6 characters')
    .matches(/\d/).withMessage('Password must contain a number')
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
      'SELECT 1 FROM users WHERE username = ? OR email = ? LIMIT 1',
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

    const hashedPassword = await bcrypt.hash(req.body.password, 12)
    await pool.execute(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [req.body.username, req.body.email, hashedPassword]
    )

    req.session.success = 'Signup successful! Please login'
    return res.redirect('/login')

  } catch (err) {
    console.error('Signup error:', err)
    return res.render('signup', {
      title: 'Sign Up',
      error: 'Registration failed. Please try again.',
      success: null,
      user: null
    })
  }
})

// Profile Routes
router.get('/user-info', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.session.user.id)
    res.render('user-info', {
      title: 'Complete Your Profile',
      error: null,
      profile: profile || null
    })
  } catch (err) {
    console.error('Profile load error:', err)
    req.session.error = 'Error loading profile form'
    res.redirect('/dashboard')
  }
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

    return res.redirect('/training-plan')

  } catch (err) {
    console.error('Profile save error:', err)
    res.render('user-info', {
      title: 'Complete Your Profile',
      error: 'Failed to save your information. Please try again.',
      profile: req.body
    })
  }
})

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
// Training Plan Routes
router.get('/training-plan', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.session.user.id)
    if (!profile) {
      req.session.error = 'Please complete your profile first'
      return res.redirect('/user-info')
    }

    const ageGroup = getAgeGroup(profile.age)
    const [trainingPlans] = await pool.execute(
      'SELECT * FROM training_plans WHERE goal = ? AND age_group = ?',
      [profile.goal, ageGroup]
    )

    if (!trainingPlans.length) {
      req.session.error = 'No training plan available for your profile'
      return res.redirect('/dashboard')
    }

    const [nutritionPlans] = await pool.execute(
      'SELECT * FROM nutrition_plans WHERE training_plan_id = ?',
      [trainingPlans[0].id]
    )

    res.render('training-plan', {
      title: 'Your Training Plan',
      user: req.session.user,
      profile,
      plan: trainingPlans[0],
      nutritionPlan: nutritionPlans[0] || null
    })

  } catch (err) {
    console.error('Training plan error:', err)
    req.session.error = 'Error loading training plan'
    res.redirect('/dashboard')
  }
})

// Nutrition Plan Route
router.get('/nutrition-plan', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.session.user.id)
    if (!profile) {
      req.session.error = 'Please complete your profile first'
      return res.redirect('/user-info')
    }

    const ageGroup = getAgeGroup(profile.age)
    const [trainingPlans] = await pool.execute(
      'SELECT id FROM training_plans WHERE goal = ? AND age_group = ?',
      [profile.goal, ageGroup]
    )

    if (!trainingPlans.length) {
      req.session.error = 'No training plan available for your profile'
      return res.redirect('/dashboard')
    }

    const [nutritionPlans] = await pool.execute(
      'SELECT * FROM nutrition_plans WHERE training_plan_id = ?',
      [trainingPlans[0].id]
    )

    if (!nutritionPlans.length) {
      req.session.error = 'No nutrition plan available for your profile'
      return res.redirect('/dashboard')
    }

    res.render('nutrition-plan', {
      title: 'Nutrition Plan',
      user: req.session.user,
      nutritionPlan: nutritionPlans[0],
      profile
    })

  } catch (err) {
    console.error('Nutrition plan error:', err)
    req.session.error = 'Error loading nutrition plan'
    res.redirect('/dashboard')
  }
})


// Dashboard Route
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.session.user.id)
    if (!profile) {
      req.session.error = 'Please complete your profile first'
      return res.redirect('/user-info')
    }

    const ageGroup = getAgeGroup(profile.age)
    const [trainingPlans] = await pool.execute(
      'SELECT * FROM training_plans WHERE goal = ? AND age_group = ? LIMIT 1',
      [profile.goal, ageGroup]
    )

    let nutritionPlan = null
    if (trainingPlans.length) {
      const [nutritionPlans] = await pool.execute(
        'SELECT * FROM nutrition_plans WHERE training_plan_id = ? LIMIT 1',
        [trainingPlans[0].id]
      )
      nutritionPlan = nutritionPlans[0] || null
    }

    res.render('dashboard', {
      title: 'Dashboard',
      user: req.session.user,
      profile,
      trainingPlan: trainingPlans[0] || null,
      nutritionPlan
    })

  } catch (err) {
    console.error('Dashboard error:', err)
    req.session.error = 'Error loading dashboard'
    res.redirect('/login')
  }
})

// Logout Route
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Session destruction error:', err)
    }
    res.redirect('/login')
  })
})

export default router