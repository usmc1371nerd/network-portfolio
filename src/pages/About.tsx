import { TrainingCard } from '../components/about/TrainingCard.tsx'

const trainingItems = [
  {
    title: 'Google Cybersecurity Professional Certificate',
    description:
      'Completed structured training covering security operations, risk management, network defense, incident response, and threat detection principles.',
  },
    {
    title: 'Certified in Cybersecurity — (ISC)²',
    description:
      'Initially unsuccessful on my first attempt. I printed the result and posted it on the wall as a daily reminder to improve. Studied consistently for two months and passed. Failure is feedback, not a finish line.',
  },
  {
    title: 'Full Stack Development Program — Bottega University',
    description:
      'Completed an intensive development program covering React, Python, JavaScript, and database design. Provided the engineering foundation that supports current security-focused work.',
  },
  {
    title: 'IriusRisk Threat Modeling Hackathon 2025',
    description:
      'Led a small team in developing a STRIDE-based threat model for an autonomous vehicle system under time constraints. Focus areas included trust boundary identification, attack path mapping, and risk prioritization.',
  },
  {
    title: 'IriusRisk Threat Modeling Hackathon 2026',
    description:
      'Served as team lead and completed the threat model independently after team participation dropped off. Successfully delivered a complete model and received positive mentor feedback for structure, persistence, and analytical approach.',
  },
  {
    title: 'Diver OSINT CTF Challenge',
    description:
      'Participated in a global OSINT challenge involving geolocation analysis, metadata extraction, and investigative pivoting techniques under time pressure.',
  },
]

export function About() {
  return (
    <div className="about-page">
      <section className="about-section">
        <h1>About</h1>
        <p>
          I work at the intersection of cybersecurity, network operations, and software delivery, with
          a focus on practical problem solving and clear technical communication. My background includes
          military Red Cell experience, technical support in regulated environments, and hands-on
          development of tools used to test, analyze, and better understand how systems behave under
          real-world conditions.
        </p>
        <p>
          I tend to approach technology with equal parts curiosity and skepticism. I like understanding
          how things work, how they break, and how they can be improved. That mindset naturally led me
          toward threat modeling, OSINT research, and security-focused development.
        </p>
        <p>
          My transition into tech started in 2022 when I left a construction project management role
          midway through a six-month Full Stack Developer program to pursue software and cybersecurity
          full time. During that program I worked with React, Python, JavaScript, and relational
          databases, building the technical foundation that now supports my security-focused work.
        </p>
        <p>
          Since then, I have continued developing skills in defensive security strategy, investigative
          research methods, and system design. I prefer hands-on learning environments where theory is
          tested against realistic scenarios.
        </p>
        <p>
          This portfolio is a working lab as much as it is a resume. Some projects are polished, others
          are experiments, but all of them reflect deliberate practice and continuous improvement.
        </p>
        <p>Also, occasionally, questionable humor embedded in terminal output.</p>
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
        <h2>Selected Training and Exercises</h2>
        <div className="training-grid">
          {trainingItems.map((item) => (
            <TrainingCard key={item.title} title={item.title} description={item.description} />
          ))}
        </div>
      </section>
    </div>
  )
}
