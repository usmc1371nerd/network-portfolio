import { NavLink } from 'react-router-dom'
import { RESUME_DOWNLOAD_NAME, RESUME_URL } from '../constants/resume'

export function Navbar() {
  return (
    <header className="gui-navbar">
      <div className="gui-navbar-brand">
        {/* <h1>JP's Portfolio</h1> */}
       
      </div>
      <nav>
        <NavLink to="/">Terminal</NavLink>
        <NavLink to="/gui">Home</NavLink>
        <NavLink to="/gui/about">About</NavLink>
        <NavLink to="/gui/projects">Projects</NavLink>
        <NavLink to="/gui/experience">Experience</NavLink>
        {/* <NavLink to="/gui/blog">Blog</NavLink> */}
        <NavLink to="/gui/contact">Connect</NavLink>
         <a href={RESUME_URL} download={RESUME_DOWNLOAD_NAME} className="gui-resume-link">
          Grab Resume
        </a>
      </nav>
    </header>
  )
}
