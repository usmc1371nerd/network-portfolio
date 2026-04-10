import { Router } from 'express'
import { body } from 'express-validator'
import { loginController } from '../controllers/authController.js'

export const authRouter = Router()

authRouter.post(
  '/login',
  body('email').isEmail().isLength({ max: 255 }),
  body('password').isString().isLength({ min: 8, max: 255 }),
  loginController,
)
