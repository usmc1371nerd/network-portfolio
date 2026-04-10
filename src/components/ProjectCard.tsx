type ProjectCardProps = {
  title: string
  description: string
  stack: string[]
  href: string
}

export function ProjectCard({
  title,
  description,
  stack,
  href,
}: ProjectCardProps) {

  const isLink = href.startsWith('http')

  return (

    <div className="card project-card training-card">

      <h3>{title}</h3>

      <p>{description}</p>

      <p className="stack">
        Stack: {stack.join(', ')}
      </p>

      {isLink && (

        <a href={href} target="_blank" rel="noopener noreferrer">

          View Project

        </a>

      )}

    </div>

  )
}