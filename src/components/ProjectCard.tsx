type ProjectCardProps = {
  title: string
  description: string
  stack: string[]
  href?: string
  links?: { label: string; href: string }[]
  availabilityText?: string
}

export function ProjectCard({
  title,
  description,
  stack,
  href,
  links,
  availabilityText,
}: ProjectCardProps) {
  const normalizedLinks = links ?? (href && href.startsWith('http') ? [{ label: 'View Project', href }] : [])

  return (
    <div className="card project-card training-card">
      <h3>{title}</h3>
      <p>{description}</p>
      <p className="stack">Stack: {stack.join(', ')}</p>
      {availabilityText ? <p>{availabilityText}</p> : null}
      {normalizedLinks.length > 0 ? (
        <div className="project-links">
          {normalizedLinks.map((link) => (
            <a key={`${title}-${link.label}`} href={link.href} target="_blank" rel="noopener noreferrer">
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  )
}
