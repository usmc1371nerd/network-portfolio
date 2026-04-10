
# GitHub Copilot Prompt

## TASK

Update the existing `/about` route in this React + TypeScript portfolio application.

This application includes both:

• a simulated terminal interface  
• a GUI mode toggle  
• multiple existing routes (Home, About, Projects, Experience, Blog, Contact)

The terminal experience is a core feature of the application and MUST NOT be modified.

This task ONLY updates the About page content and adds a structured accomplishments section.

---

## CONSTRAINTS

DO NOT modify:

• Terminal components  
• CLI parsing logic  
• routing structure  
• global styles  
• navigation menu behavior  
• existing layout wrapper components  
• header or footer components  
• Launch GUI Mode functionality  
• state logic used by terminal interface  
• socket or simulation logic  
• command handlers  
• keyboard input behavior  

Only update the About page content.

---

## FILE SCOPE

Work only inside the About page component.

Example:

/src/pages/About.tsx  
or  
/src/routes/About.tsx  
or similar structure

If components are created, place them in:

/src/components/about/

---

## CONTENT STRUCTURE

The About page should contain 3 sections:

1. About
2. Skills Summary
3. Selected Training and Exercises

Maintain the existing dark cyber theme.

Use semantic HTML structure.

---

## SECTION 1

### Header

About

### Body Text

I work at the intersection of cybersecurity, network operations, and software delivery, with a focus on practical problem solving and clear technical communication. My background includes military Red Cell experience, technical support in regulated environments, and hands-on development of tools used to test, analyze, and better understand how systems behave under real-world conditions.

I tend to approach technology with equal parts curiosity and skepticism. I like understanding how things work, how they break, and how they can be improved. That mindset naturally led me toward threat modeling, OSINT research, and security-focused development.

My transition into tech started in 2022 when I left a construction project management role midway through a six-month Full Stack Developer program to pursue software and cybersecurity full time. During that program I worked with React, Python, JavaScript, and relational databases, building the technical foundation that now supports my security-focused work.

Since then, I have continued developing skills in defensive security strategy, investigative research methods, and system design. I prefer hands-on learning environments where theory is tested against realistic scenarios.

This portfolio is a working lab as much as it is a resume. Some projects are polished, others are experiments, but all of them reflect deliberate practice and continuous improvement.

Also, occasionally, questionable humor embedded in terminal output.

---

## SECTION 2

### Header

Skills Summary

### Bullet Points

Threat modeling and attack surface analysis  
OSINT research and investigative workflows  
Network analysis and troubleshooting  
React, TypeScript, Node.js, Python  
Technical documentation and knowledge transfer  
Secure system design fundamentals  

Render as unordered list matching current style.

---

## SECTION 3

### Header

Selected Training and Exercises

Create a responsive card layout.

Each item should be visually consistent with the existing theme.

Use subtle borders or glow effects.

Cards should stack vertically on mobile.

---

### CARD DATA

Title:
Google Cybersecurity Professional Certificate

Description:
Completed structured training covering security operations, risk management, network defense, incident response, and threat detection principles.

---

Title:
Full Stack Development Program — Bottega University

Description:
Completed an intensive development program covering React, Python, JavaScript, and database design. Provided the engineering foundation that supports current security-focused work.

---

Title:
IriusRisk Threat Modeling Hackathon 2025

Description:
Led a small team in developing a STRIDE-based threat model for an autonomous vehicle system under time constraints. Focus areas included trust boundary identification, attack path mapping, and risk prioritization.

---

Title:
IriusRisk Threat Modeling Hackathon 2026

Description:
Served as team lead and completed the threat model independently after team participation dropped off. Successfully delivered a complete model and received positive mentor feedback for structure, persistence, and analytical approach.

---

Title:
Diver OSINT CTF Challenge

Description:
Participated in a global OSINT challenge involving geolocation analysis, metadata extraction, and investigative pivoting techniques under time pressure.

---

## STYLING GUIDELINES

Match existing theme:

dark background  
subtle cyber aesthetic  
clean spacing  
minimal bright colors  
professional appearance  

Card styling suggestion:

border: 1px solid rgba(0,255,255,0.15)
border-radius: 8px
padding: 16px
margin-bottom: 16px
background: rgba(0,0,0,0.25)

Optional hover:

slight glow or border brighten

---

## ACCESSIBILITY

Use proper heading hierarchy:

h1 for page title  
h2 for section titles  

Ensure readable contrast.

---

## PERFORMANCE

Do not introduce heavy libraries.

Do not change global CSS.

Keep components lightweight.

---

## GOAL

Improve professionalism and credibility of the About page while preserving the interactive terminal-driven identity of the portfolio.

The page should feel consistent with the rest of the site and not visually disrupt the terminal aesthetic.
