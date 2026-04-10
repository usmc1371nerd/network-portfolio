const timeline = [
  {
    title: 'Cybersecurity, and Engineering',
    period: 'Current',
    detail:
      'Designs, builds, and tests practical security-focused systems, network labs, and full-stack applications. Work often centers on understanding system behavior, identifying attack surface considerations, and improving reliability through thoughtful engineering and clear documentation. Applies security engineering principles across development workflows, incorporating threat modeling awareness, automation where appropriate, and structured testing approaches that support resilient system design. Hands-on experience working across modern tooling while maintaining a curiosity-driven approach to solving technical problems and reducing unnecessary complexity.',
  },
  {
    title: 'Military Experience',
    period: 'Service Background',
    detail:
      'Developed strong operational discipline, mission-focused communication, and leadership under pressure. Experience operating in structured environments where preparation, accountability, and adaptability directly influenced mission outcomes. This background continues to shape a methodical approach to technical work, emphasizing situational awareness, risk consideration, and calm decision-making when systems or requirements change unexpectedly.',
  },
  {
    title: 'Project Management Progression',
    period: 'Leadership Development',
    detail:
      'Progressed from entry-level project coordination into regional-level construction management responsibilities, overseeing multi-phase projects, timelines, budgets, and cross-functional teams. Experience includes coordinating stakeholders across technical and non-technical environments, managing competing priorities, and maintaining alignment between strategic goals and operational execution. This foundation supports structured planning, risk awareness, and the ability to translate complex technical efforts into clear progress indicators for leadership.',
  },
  {
    title: 'Skills Progression',
    period: 'Ongoing',
    detail:
      'Expanded from infrastructure fundamentals into full-stack development, practical automation, and both defensive and offensive security concepts. Continuously building experience in threat modeling approaches, OSINT research workflows, system design thinking, and identifying areas where automation can improve reliability or reduce manual overhead. Focus remains on developing adaptable technical judgment and a security engineering mindset that balances curiosity with responsibility.',
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
