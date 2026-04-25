import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { body } from 'express-validator'
import { sendContactMessageController } from '../controllers/contactController.js'

export const contactRouter = Router()

const contactRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many contact submissions. Please try again later.' },
})

contactRouter.post(
  '/contact',
  contactRateLimiter,
  body('name').isString().trim().isLength({ min: 2, max: 120 }),
  body('email').isEmail().isLength({ max: 255 }),
  body('message').isString().trim().isLength({ min: 10, max: 5000 }),
  sendContactMessageController,
)
