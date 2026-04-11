import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { body } from 'express-validator'
import {
  bootstrapAdminController,
  changePasswordController,
  loginController,
  setupStatusController,
} from '../controllers/authController.js'
import { authMiddleware } from '../middleware/authMiddleware.js'

export const authRouter = Router()

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
})

const setupRateLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many setup attempts. Please try again later.' },
})

const accountRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many account requests. Please try again later.' },
})

authRouter.get('/setup/status', setupStatusController)

authRouter.post(
  '/setup/bootstrap-admin',
  setupRateLimiter,
  body('email').isEmail().isLength({ max: 255 }),
  body('password').isString().isLength({ min: 12, max: 255 }),
  body('setupSecret').isString().isLength({ min: 12, max: 255 }),
  bootstrapAdminController,
)

authRouter.post(
  '/login',
  loginRateLimiter,
  body('email').isEmail().isLength({ max: 255 }),
  body('password').isString().isLength({ min: 8, max: 255 }),
  loginController,
)

authRouter.post(
  '/account/change-password',
  accountRateLimiter,
  authMiddleware,
  body('currentPassword').isString().isLength({ min: 8, max: 255 }),
  body('newPassword').isString().isLength({ min: 12, max: 255 }),
  changePasswordController,
)
