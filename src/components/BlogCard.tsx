import { Link } from 'react-router-dom'

type BlogCardProps = {
  title: string
  excerpt: string
  slug: string
  publishDate: string
}

export function BlogCard({ title, excerpt, slug, publishDate }: BlogCardProps) {
  return (
    <article className="card">
      <h3>{title}</h3>
      <p>{excerpt}</p>
      <p className="meta">Published: {new Date(publishDate).toLocaleDateString()}</p>
      <Link to={`/gui/blog/${slug}`}>Read post</Link>
    </article>
  )
}
