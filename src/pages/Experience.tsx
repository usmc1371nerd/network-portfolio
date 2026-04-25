const timeline = [
  {
    title: 'Cybersecurity, and Engineering',
    period: 'Current',
    detail:
      'Builds for research purposes, using hands-on labs, home server projects, and full-stack web apps to explore networking and security concepts. Focuses on understanding how systems behave, documenting findings clearly, and learning security engineering principles through practical experimentation. Research often centers on how ideas can be applied responsibly in real-world environments, with steady attention to reliability, usability, and reducing unnecessary complexity through better structure and repeatable workflows.',
  },
  {
    title: 'Military Experience',
    period: 'Service Background',
    detail:
      'Progressed from a construction operations team leader in the Marines to a team leader in a Reconnaissance platoon in the Army National Guard. Served as an Operations NCO and lead instructor, coordinating 100 trainees, 5 staff, and outside agencies while managing planning, logistics, and execution under pressure. That background built operational discipline, accountability, situational awareness, and calm decision-making that still shape how I approach technical work and leadership today.',
  },
  {
    title: 'Project Management Progression',
    period: 'Leadership Development',
    detail:
      'Progressed from project coordination into regional construction management, overseeing more than 20 projects at a time, coordinating 30 subcontractors, and managing $3M+ in building work. Responsibilities included scheduling, budgets, logistics, stakeholder coordination, and keeping multi-phase work aligned across teams. That experience strengthened structured planning, cross-functional communication, risk awareness, and the ability to keep complex efforts moving while balancing deadlines, resources, and changing field conditions.',
  },
  {
    title: 'Skills Progression',
    period: 'Ongoing',
    detail:
      'Started in a full stack development program, then expanded into networking, cybersecurity, and OSINT through hands-on labs, practical projects, and steady self-directed learning. Long-term goals include completing a bachelor\'s in intelligence with a cyber focus, gaining more experience in physical and network pentesting, and earning certifications such as CompTIA Security+ and PenTest+.',
  },
]

export function Experience() {
  return (
    <section>
      <h2>Experience</h2>
      <div className="timeline">
        {timeline.map((item) => (
          <article key={item.title} className="timeline-item training-card">
            <h3>{item.title}</h3>
            <p className="meta">{item.period}</p>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
