import { NavLink } from 'react-router-dom'

export function Navbar() {
  return (
    <header className="gui-navbar">
      <h1>JP Portfolio TEST2 PIPELINE</h1>
      <nav>
        <NavLink to="/">Terminal</NavLink>
        <NavLink to="/gui">Home</NavLink>
        <NavLink to="/gui/about">About</NavLink>
        <NavLink to="/gui/projects">Projects</NavLink>
        <NavLink to="/gui/experience">Experience</NavLink>
        <NavLink to="/gui/blog">Blog</NavLink>
        <NavLink to="/gui/contact">Contact</NavLink>
      </nav>
    </header>
  )
}
