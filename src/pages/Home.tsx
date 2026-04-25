import { TypewriterLoop } from '../components/home/TypewriterLoop.tsx'

export function Home() {
  return (
    <div className="home-page">
      <div className="home-center">
        <section className="home-welcome">
          <h1 className="home-heading">WELCOME</h1>
          <p className="home-subtext">
            I help teams solve complex technical issues under pressure with minimal downtime by
            bringing structure, clarity, and decisive action.
          </p>
          <div className="home-actions">
            {/* <a
              className="home-resume-button"
              href={RESUME_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Grab Resume
            </a> */}
          </div>
        </section>

        <section className="home-typewriter" aria-label="Identity">
          <TypewriterLoop />
        </section>
      </div>

      {/* <ScrollingFooter /> */}
    </div>
  )
}
