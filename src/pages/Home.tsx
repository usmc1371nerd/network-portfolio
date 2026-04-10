import { ScrollingFooter } from '../components/home/ScrollingFooter.tsx'
import { TypewriterLoop } from '../components/home/TypewriterLoop.tsx'

export function Home() {
  return (
    <div className="home-page">
      <div className="home-center">
        <section className="home-welcome">
          <h1 className="home-heading">WELCOME</h1>
          <p className="home-subtext">Thank you for visiting.</p>
          <p className="home-subtext">Enjoy exploring the lab.</p>
        </section>

        <section className="home-typewriter" aria-label="Identity">
          <TypewriterLoop />
        </section>
      </div>

      <ScrollingFooter />
    </div>
  )
}
