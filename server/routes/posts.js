import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { body, param, query } from 'express-validator'
import {
  createPostController,
  deletePostController,
  getPostBySlugController,
  listPostsController,
  updatePostController,
} from '../controllers/postsController.js'
import { authMiddleware } from '../middleware/authMiddleware.js'

export const postsRouter = Router()

const adminWriteRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many write requests. Please try again later.' },
})

const postPayloadValidators = [
  body('title').isString().trim().isLength({ min: 1, max: 255 }),
  body('slug').isString().trim().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  body('excerpt').isString().trim().isLength({ min: 1, max: 1000 }),
  body('content').isString().isLength({ min: 1, max: 500000 }),
  body('status').isIn(['draft', 'published']),
  body('published_at').optional().isISO8601().toDate(),
]

postsRouter.get('/posts', query('scope').optional().isIn(['published', 'all']), listPostsController)
postsRouter.get('/posts/:slug', param('slug').isString().trim().isLength({ min: 1, max: 255 }), getPostBySlugController)

postsRouter.post('/posts', adminWriteRateLimiter, authMiddleware, postPayloadValidators, createPostController)
postsRouter.put(
  '/posts/:id',
  adminWriteRateLimiter,
  authMiddleware,
  param('id').isInt({ min: 1 }),
  postPayloadValidators,
  updatePostController,
)
postsRouter.delete('/posts/:id', adminWriteRateLimiter, authMiddleware, param('id').isInt({ min: 1 }), deletePostController)
