import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { body } from 'express-validator'
import { loginController } from '../controllers/authController.js'

export const authRouter = Router()

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
})

authRouter.post(
  '/login',
  loginRateLimiter,
  body('email').isEmail().isLength({ max: 255 }),
  body('password').isString().isLength({ min: 8, max: 255 }),
  loginController,
)
