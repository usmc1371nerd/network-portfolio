import { TrainingCard } from '../components/about/TrainingCard.tsx'

const trainingItems = [
  {
    title: 'Google Cybersecurity Professional Certificate',
    description:
      'Training in security operations, risk management, network defense, incident response, and threat detection.',
  },
  {
    title: 'Certified in Cybersecurity - (ISC)2',
    description:
      'Failed the first attempt, studied for two more months, and passed. Good reminder that failure is feedback.',
  },
  {
    title: 'Full Stack Development Program - Bottega University',
    description:
      'Training in React, Python, JavaScript, and databases that still supports my security-focused work.',
  },
  {
    title: 'IriusRisk Threat Modeling Hackathon 2025',
    description:
      'Led a small team building a STRIDE-based threat model for an autonomous vehicle system under time pressure.',
  },
  {
    title: 'IriusRisk Threat Modeling Hackathon 2026',
    description:
      'Took over solo after team participation dropped and still delivered a complete threat model with strong mentor feedback.',
  },
  {
    title: 'Diver OSINT CTF Challenge',
    description:
      'OSINT challenge focused on geolocation, metadata, and fast investigative pivoting.',
  },
]

export function About() {
  return (
    <div className="about-page">
      <section className="about-section">
        <h1>whoami</h1>
      </section>

      <section className="about-section">
        <h2>Skills Summary</h2>
        <ul className="skills-list">
          <li>Threat modeling and attack surface analysis</li>
          <li>OSINT research and investigative workflows</li>
          <li>Network analysis and troubleshooting</li>
          <li>React, TypeScript, Node.js, Python</li>
          <li>Technical documentation and knowledge transfer</li>
          <li>Secure system design fundamentals</li>
        </ul>
      </section>

      <section className="about-section">
        <h2>Background</h2>
        <p>
          I moved from military service and construction project management into tech, bringing an
          adaptable mindset, calm execution under pressure, and a habit of learning fast when the mission changes.
        </p>
        <p>
          I like understanding how systems work, how they fail, and how they can be improved. That
          led me toward threat modeling, OSINT, and security-focused development.
        </p>
        <p>
          I moved into tech in 2022 after leaving construction project management during a six-month
          full stack program to pursue software and cybersecurity full time. That work gave me the
          engineering base I still build on.
        </p>
        <p>
          Since then I have focused on defensive security, investigative research, and hands-on lab
          work where theory gets tested against realistic scenarios.
        </p>
        <p>
          This portfolio is a working lab as much as a resume. Some parts are polished, some are still
          experiments, but all of it reflects deliberate practice and steady improvement.
        </p>
        <p>Also: occasional questionable terminal humor.</p>
      </section>

      <section className="about-section">
        <h2>Training and Certificates</h2>
        <div className="training-grid">
          {trainingItems.map((item) => (
            <TrainingCard key={item.title} title={item.title} description={item.description} />
          ))}
        </div>
      </section>
    </div>
  )
}
