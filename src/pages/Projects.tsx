import { ProjectCard } from '../components/ProjectCard'

const projects = [
  {
    title: 'CyberScout Labs (Private repository)', 
    description:
      'Scenario-based OSINT training platform designed to simulate investigative workflows and intelligence gathering techniques. Includes controlled datasets, guided exercises, and structured methodology focused on ethical information analysis.',
    stack: ['Linux', 'Python', 'OSINT methodology', 'CTF design'],
    href: 'Private Repository',
  },
  {
    title: 'OSINT Toolkit',
    description:
      'Python-based research pivot tool that accelerates open-source investigations by launching targeted queries across multiple intelligence sources including search engines, whitepages, WHOIS, and social platforms. Designed to reduce manual search friction and maintain structured investigative flow.',
    stack: ['Python', 'OSINT', 'investigative workflows'],
    href: 'https://github.com/usmc1371nerd/OSINT-Search/blob/main/app.py',
  },
  {
    title: 'OSINT Tool (Recon Utility)',
    description:
      'Collection of lightweight reconnaissance utilities supporting username discovery, social profile correlation, and digital footprint enumeration. Built to support structured intelligence gathering workflows.',
    stack: ['Python', 'OSINT'],
    href: 'https://github.com/usmc1371nerd/OSINT-Tool',
  },
  {
    title: 'TED Encryption Device (Private repository)',
    description:
      'Hardware-assisted encryption key generator using Raspberry Pi Pico and modified USB switch hardware. Physical binary inputs mapped to shared secrets for secure communication experiments and key exchange research.',
    stack: ['Python', 'Raspberry Pi Pico', 'serial communication', 'hardware interface'],
    href: 'Private Repository',
  },
  {
    title: 'HL7 Message Generator',
    description:
      'Python-based tool for generating structured HL7 medical messages for interface testing. Supports configurable message types and malformed message scenarios for integration validation and troubleshooting.',
    stack: ['Python', 'HL7', 'healthcare interoperability'],
    href: 'https://github.com/usmc1371nerd/HL7-generator',
  },
  {
    title: 'Linux Server Lab (CTF Host, Private repository)',
    description:
      'Self-hosted Ubuntu server environment used to deploy OSINT training scenarios and CTF-style exercises. Utilizes Docker-based services and Tailscale for secure remote access control.',
    stack: ['Ubuntu', 'Docker', 'Tailscale', 'CTF design'],
    href: 'Private Repository',
  },
  {
    title: 'Interactive Resume Deployment Pipeline',
    description:
      'Version-controlled resume platform with structured deployment workflow. Supports rapid content updates, Git-based version tracking, and flexible hosting integration.',
    stack: ['HTML', 'GitHub', 'Hostinger'],
    href: 'https://github.com/usmc1371nerd/html-resume',
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