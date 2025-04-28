import express from 'express'
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import {body, validationResult} from 'express-validator'

const router = express.Router()

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

  // Get and clear any success message from session
  const success = req.session.success
  if (req.session.success) {
    delete req.session.success
  }

  res.render('login', {
    title: 'Login',
    error: null,
    user: null,
    success: success  // Pass the success message
  })
})

// For the POST request on /login
router.post('/login', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.render('login', {title: 'Login', error: errors.array()[0].msg, user: null})
  }

  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [req.body.username])

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

    // Check if user has completed their profile (i.e., age, height, weight, goal)
    const [profile] = await pool.execute('SELECT * FROM user_info WHERE user_id = ?', [user.id])

    // If the profile is incomplete, redirect to the profile completion page
    if (profile.length === 0) {
      return res.redirect('/user-info')
    }

    // If profile is complete, redirect to the dashboard
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
      success: null,  // Explicitly pass null for success
      user: null
    })
  }

  try {
    const [existing] = await pool.execute(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [req.body.username, req.body.email]
    )

    if (existing.length > 0) {
      return res.render('signup', {
        title: 'Sign Up',
        error: 'Username or email already exists',
        success: null,  // Explicitly pass null for success
        user: null
      })
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10)

    await pool.execute(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [req.body.username, req.body.email, hashedPassword]
    )

    // After successful signup
    return res.render('signup', {
      title: 'Sign Up',
      error: null,  // Explicitly pass null for error
      success: 'Signup successful! Redirecting to login...',
      user: null
    })
  } catch (err) {
    console.error(err)
    res.render('signup', {
      title: 'Sign Up',
      error: 'Registration failed',
      success: null,  // Explicitly pass null for success
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


router.post('/user-info', [
  body('height').isInt({min: 50, max: 250}).withMessage('Height must be a valid number between 50 and 250 cm'),
  body('weight').isFloat({min: 30, max: 300}).withMessage('Weight must be a valid number between 30 and 300 kg'),
  body('age').isInt({min: 18, max: 100}).withMessage('Age must be between 18 and 100'),
  body('goal').notEmpty().withMessage('Please select a fitness goal')
], async (req, res) => {
  const errors = validationResult(req)

  if (!errors.isEmpty()) {
    return res.render('user-info', {
      title: 'Complete Your Profile',
      error: errors.array()[0].msg
    })
  }

  try {
    const {height, weight, age, goal} = req.body
    const userId = req.session.user.id

    // Save the user info in the database
    await pool.execute(
      'INSERT INTO user_info (user_id, height, weight, age, goal) VALUES (?, ?, ?, ?, ?)',
      [userId, height, weight, age, goal]
    )

    // Redirect to dashboard
    res.redirect('/dashboard')
  } catch (err) {
    console.error(err)
    res.render('user-info', {
      title: 'Complete Your Profile',
      error: 'Failed to save your information. Please try again.'
    })
  }
})


// After successful signup, redirect to user info page
router.get('/user-info', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login')
  }
  res.render('user-info', {title: 'User Info', error: null})
})

router.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login')
  }
  res.render('dashboard', {
    title: 'Dashboard',
    user: req.session.user
  })
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
