export interface FileSystemDirectory {
  [key: string]: FileSystemNode
}

export type FileSystemNode = string | FileSystemDirectory

export const serverFileSystem: FileSystemDirectory = {
  '.secretfile':
    'note: guest should not be able to access hidden network at 10.0.13.37, ssh user shadow, do not leave on root.',
  about: {
    'summary.txt':
      'I work across cybersecurity, network operations, and software delivery with a focus on practical problem solving. This portfolio is a working lab as much as a resume.',
  },
  projects: {
    'network-lab.txt':
      'Interactive frontend simulation of network devices, packet flow events, and terminal-based exploration.\nLive: https://network-lab-e5f4.onrender.com/',
    'cyberscout.txt':
      'Scenario-based OSINT training lab with guided exercises, controlled datasets, and structured investigative workflows.',
    'osint-toolkit.txt':
      'Python pivot tool that speeds up open-source research across search engines, WHOIS, whitepages, and social platforms.',
    'recon-utility.txt':
      'Lightweight recon utilities for username discovery, social profile correlation, and digital footprint enumeration.',
    'ted-encryption-device.txt':
      'Hardware-assisted key generation experiment using Raspberry Pi Pico and modified USB switch hardware.',
    'hl7-message-generator.txt':
      'Python tool for generating HL7 messages for interface testing, malformed message checks, and troubleshooting.',
    'linux-server-lab.txt':
      'Self-hosted Ubuntu lab for OSINT scenarios and CTF-style exercises using Docker and Tailscale.',
    'interactive-resume-pipeline.txt':
      'Version-controlled resume site with quick content updates, Git-based tracking, and simple hosting deployment.\nLive: https://resume.jpsportfolio.com/',
  },
  skills: {
    'core.txt':
      'Core: TCP/IP, subnetting, routing, switching, VLAN design, ACLs, troubleshooting, and secure network baselines.',
    'tools.txt': 'Tools: Wireshark, Nmap, Cisco Packet Tracer, Linux CLI, Git, and SIEM fundamentals.',
    'certifications.txt':
      'Certification roadmap: Network+, Security+, CCNA, and cloud security specializations.',
  },
  training: {
    'google-cybersecurity.txt':
      'Google Cybersecurity Professional Certificate: training in security operations, risk management, network defense, incident response, and threat detection.',
    'isc2-cc.txt':
      'Certified in Cybersecurity - (ISC)2: failed the first attempt, studied for two more months, and passed. Good reminder that failure is feedback.',
    'bottega-full-stack.txt':
      'Full Stack Development Program - Bottega University: training in React, Python, JavaScript, and databases that still supports my security-focused work.',
    'iriusrisk-2025.txt':
      'IriusRisk Threat Modeling Hackathon 2025: led a small team building a STRIDE-based threat model for an autonomous vehicle system under time pressure.',
    'iriusrisk-2026.txt':
      'IriusRisk Threat Modeling Hackathon 2026: took over solo after team participation dropped and still delivered a complete threat model with strong mentor feedback.',
    'diver-osint-ctf.txt':
      'Diver OSINT CTF Challenge: OSINT challenge focused on geolocation, metadata, and fast investigative pivoting.',
  },
  experience: {
    'timeline.txt': 'Hands-on home lab deployments, volunteer tech support, and iterative portfolio engineering.',
    'learning.txt':
      'Current focus areas include cloud networking, threat hunting playbooks, and Python-powered network automation.',
  },
  contact: {
    'info.txt':
      'Reach out for collaboration, mentorship, or entry-level network/security opportunities at usmcnerd1371@proton.me.',
  },
  resume: {
    'resume.txt':
      'Current resume site: https://resume.jpsportfolio.com/\nA downloadable resume file will be added soon.',
  },
}
