import { Router } from 'express'
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

const postPayloadValidators = [
  body('title').isString().trim().isLength({ min: 1, max: 255 }),
  body('slug').isString().trim().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  body('excerpt').isString().trim().isLength({ min: 1, max: 1000 }),
  body('content').isString().isLength({ min: 1, max: 500000 }),
  body('status').isIn(['draft', 'published']),
]

postsRouter.get('/posts', query('scope').optional().isIn(['published', 'all']), listPostsController)
postsRouter.get('/posts/:slug', param('slug').isString().trim().isLength({ min: 1, max: 255 }), getPostBySlugController)

postsRouter.post('/posts', authMiddleware, postPayloadValidators, createPostController)
postsRouter.put(
  '/posts/:id',
  authMiddleware,
  param('id').isInt({ min: 1 }),
  postPayloadValidators,
  updatePostController,
)
postsRouter.delete('/posts/:id', authMiddleware, param('id').isInt({ min: 1 }), deletePostController)
