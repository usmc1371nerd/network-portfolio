export interface FileSystemDirectory {
  [key: string]: FileSystemNode
}

export type FileSystemNode = string | FileSystemDirectory

export const serverFileSystem: FileSystemDirectory = {
  about: {
    'summary.txt':
      'Network engineer and cybersecurity learner building practical labs, automation workflows, and reliable infrastructure.',
  },
  skills: {
    'core.txt':
      'Core: TCP/IP, subnetting, routing, switching, VLAN design, ACLs, troubleshooting, and secure network baselines.',
    'tools.txt': 'Tools: Wireshark, Nmap, Cisco Packet Tracer, Linux CLI, Git, and SIEM fundamentals.',
    'learning.txt':
      'Learning: cloud networking, threat hunting playbooks, and Python-powered network automation.',
  },
  projects: {
    'network-lab.txt':
      'Interactive frontend simulation of network devices, packet flow events, and terminal-based exploration.',
  },
  experience: {
    'timeline.txt': 'Hands-on home lab deployments, volunteer tech support, and iterative portfolio engineering.',
  },
  certifications: {
    'plan.txt': 'Roadmap includes Network+, Security+, CCNA, and cloud security specializations.',
  },
  cyberscout: {
    'notes.txt': 'Curated security notes and incident-response drills for continuous learning.',
  },
  blog: {
    'welcome.txt': 'Lab breakdowns, command references, and practical writeups on networking and security.',
  },
  contact: {
    'info.txt': 'Reach out for collaboration, mentorship, or entry-level network/security opportunities.',
  },
  resume: {
    'resume.txt': 'Resume available on request in portfolio GUI mode.',
  },
}
