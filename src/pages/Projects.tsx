import { ProjectCard } from '../components/ProjectCard'

const projects = [
  {
    title: 'Network Lab',
    description:
      'Interactive network simulation with terminal-driven workflows, hidden-segment discovery, and guided command progression.',
    stack: ['React', 'TypeScript', 'React Flow', 'Vite'],
    links: [
      { label: 'Live', href: 'https://network-lab-e5f4.onrender.com/' },
      { label: 'GitHub', href: 'https://github.com/usmc1371nerd/network-portfolio' },
    ],
  },
  {
    title: 'CyberScout Labs (Private repository)',
    description:
      'Scenario-based OSINT training lab with guided exercises, controlled datasets, and structured investigative workflows.',
    stack: ['Linux', 'Python', 'OSINT methodology', 'CTF design'],
    availabilityText: 'Private Repository',
  },
  {
    title: 'OSINT Toolkit',
    description:
      'Python pivot tool that speeds up open-source research across search engines, WHOIS, whitepages, and social platforms.',
    stack: ['Python', 'OSINT', 'investigative workflows'],
    links: [{ label: 'GitHub', href: 'https://github.com/usmc1371nerd/OSINT-Search/blob/main/app.py' }],
  },
  {
    title: 'OSINT Tool (Recon Utility)',
    description:
      'Lightweight recon utilities for username discovery, social profile correlation, and digital footprint enumeration.',
    stack: ['Python', 'OSINT'],
    links: [{ label: 'GitHub', href: 'https://github.com/usmc1371nerd/OSINT-Tool' }],
  },
  {
    title: 'TED Encryption Device (Private repository)',
    description:
      'Hardware-assisted key generation experiment using Raspberry Pi Pico and modified USB switch hardware.',
    stack: ['Python', 'Raspberry Pi Pico', 'serial communication', 'hardware interface'],
    availabilityText: 'Private Repository',
  },
  {
    title: 'HL7 Message Generator',
    description:
      'Python tool for generating HL7 messages for interface testing, malformed message checks, and troubleshooting.',
    stack: ['Python', 'HL7', 'healthcare interoperability'],
    links: [{ label: 'GitHub', href: 'https://github.com/usmc1371nerd/HL7-generator' }],
  },
  {
    title: 'Linux Server Lab (CTF Host, Private repository)',
    description:
      'Self-hosted Ubuntu lab for OSINT scenarios and CTF-style exercises using Docker and Tailscale.',
    stack: ['Ubuntu', 'Docker', 'Tailscale', 'CTF design'],
    availabilityText: 'Private Repository',
  },
  {
    title: 'Interactive Resume Deployment Pipeline',
    description:
      'Version-controlled resume site with quick content updates, Git-based tracking, and simple hosting deployment.',
    stack: ['HTML', 'GitHub', 'Hostinger'],
    links: [
      { label: 'Live', href: 'https://resume.jpsportfolio.com/' },
      { label: 'GitHub', href: 'https://github.com/usmc1371nerd/html-resume' },
    ],
  },
]

export function Projects() {
  return (
    <section>
      <h2>Projects</h2>
      <div className="card-grid">
        {projects.map((project) => (
          <ProjectCard key={project.title} {...project} />
        ))}
      </div>
    </section>
  )
}
