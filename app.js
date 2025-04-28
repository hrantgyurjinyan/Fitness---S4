import express from 'express'
import session from 'express-session'
import path from 'path'
import {fileURLToPath} from 'url'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth.js'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app = express()

app.use(express.urlencoded({extended: true}))
app.use(express.json())
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')))

app.use(session({
  secret: process.env.SESSION_SECRET || 'abcde',
  resave: false,
  saveUninitialized: true,
  cookie: {secure: false}
}))

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

app.use('/', authRoutes)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})