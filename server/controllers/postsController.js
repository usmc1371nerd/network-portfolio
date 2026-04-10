import { validationResult } from 'express-validator'
import { db } from '../db/connection.js'
import { optionalAdminAuth } from '../middleware/authMiddleware.js'

function formatPostRow(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    excerpt: row.excerpt,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function listPostsController(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid query', details: errors.array() })
  }

  const scope = req.query.scope ?? 'published'

  if (scope === 'all') {
    const user = optionalAdminAuth(req)
    if (!user) {
      return res.status(401).json({ error: 'Admin token required for all posts' })
    }

    const [rows] = await db.execute(
      `SELECT id, title, slug, excerpt, content, status, created_at, updated_at
       FROM posts
       ORDER BY created_at DESC`,
    )

    return res.json(rows.map(formatPostRow))
  }

  const [rows] = await db.execute(
    `SELECT id, title, slug, excerpt, content, status, created_at, updated_at
     FROM posts
     WHERE status = 'published'
     ORDER BY created_at DESC`,
  )

  return res.json(rows.map(formatPostRow))
}

export async function getPostBySlugController(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid slug', details: errors.array() })
  }

  const { slug } = req.params

  const [rows] = await db.execute(
    `SELECT id, title, slug, excerpt, content, status, created_at, updated_at
     FROM posts
     WHERE slug = ? AND status = 'published'
     LIMIT 1`,
    [slug],
  )

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Post not found' })
  }

  return res.json(formatPostRow(rows[0]))
}

export async function createPostController(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid post payload', details: errors.array() })
  }

  const { title, slug, content, excerpt, status } = req.body

  const [result] = await db.execute(
    `INSERT INTO posts (title, slug, content, excerpt, status)
     VALUES (?, ?, ?, ?, ?)`,
    [title, slug, content, excerpt, status],
  )

  const [rows] = await db.execute(
    `SELECT id, title, slug, excerpt, content, status, created_at, updated_at
     FROM posts
     WHERE id = ?
     LIMIT 1`,
    [result.insertId],
  )

  return res.status(201).json(formatPostRow(rows[0]))
}

export async function updatePostController(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid post payload', details: errors.array() })
  }

  const postId = Number(req.params.id)
  const { title, slug, content, excerpt, status } = req.body

  const [updateResult] = await db.execute(
    `UPDATE posts
     SET title = ?, slug = ?, content = ?, excerpt = ?, status = ?
     WHERE id = ?`,
    [title, slug, content, excerpt, status, postId],
  )

  if (updateResult.affectedRows === 0) {
    return res.status(404).json({ error: 'Post not found' })
  }

  const [rows] = await db.execute(
    `SELECT id, title, slug, excerpt, content, status, created_at, updated_at
     FROM posts
     WHERE id = ?
     LIMIT 1`,
    [postId],
  )

  return res.json(formatPostRow(rows[0]))
}

export async function deletePostController(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid id', details: errors.array() })
  }

  const postId = Number(req.params.id)
  const [deleteResult] = await db.execute('DELETE FROM posts WHERE id = ?', [postId])

  if (deleteResult.affectedRows === 0) {
    return res.status(404).json({ error: 'Post not found' })
  }

  return res.json({ success: true })
}
