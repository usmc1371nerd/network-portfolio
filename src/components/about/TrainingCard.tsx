type TrainingCardProps = {
  title: string
  description: string
}

export function TrainingCard({ title, description }: TrainingCardProps) {
  return (
    <article className="training-card">
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  )
}
