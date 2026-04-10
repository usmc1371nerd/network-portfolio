# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- (Future features go here)

### Changed
- (Changes go here)

### Fixed
- (Fixes go here)

### Removed
- (Removed features go here)

---

## [1.0.0] - 2026-04-10

### Added
- **Terminal Lab**: Interactive network simulation with xterm integration
  - SSH client for guest system access
  - Virtual file browser with server file system
  - Network topology visualization using React Flow
  - Packet logging panel for network monitoring
  - Device panels for terminal and connectivity info

- **GUI Portfolio Mode**: Full-featured portfolio website
  - **Home Page**: Typewriter animation loop with identity keywords
  - **About Page**: Professional biography with skills and training cards
  - **Projects Page**: 8 portfolio projects with tech stack and GitHub links
  - **Experience Page**: 4-item timeline of professional progression
  - **Blog Page**: List and detail views for blog posts
  - **Contact Page**: Contact form interface
  - **Navigation**: Persistent navbar with route links

- **Backend API & Admin System**
  - Express.js REST API with JWT authentication
  - Admin login system with email/password
  - Blog CMS with draft/publish states
  - Markdown content rendering with XSS sanitization
  - User management with bcrypt password hashing
  - CORS configuration for frontend/backend separation

- **Database**
  - MySQL schema with users and posts tables
  - Admin user seeding script
  - Post status and timestamp management

- **Frontend Stack**
  - React 19 with TypeScript (strict mode)
  - Vite build system with optimized production bundles
  - React Router v7 for SPA routing
  - Marked.js for markdown parsing
  - DOMPurify for content sanitization

- **Styling**
  - Dark cybersecurity theme (cyan/blue palette)
  - Unified hover effects across all card components
  - Responsive grid layouts
  - Typewriter cursor animation
  - Scrolling ticker footer animation
  - Terminal green (xterm) aesthetic

- **Deployment**
  - `.htaccess` SPA fallback for Apache hosting
  - Production-ready build at `/dist`
  - Environment variable configuration
  - Hostinger-compatible MySQL setup

### Infrastructure
- **Version Control**
  - Git repository with remote GitHub origin
  - Initial commit with full project structure
  - `.gitignore` for dependencies and build artifacts

- **Deployment Tools**
  - `bump-version.ps1`: Semantic version bumping script
  - `deploy.ps1`: FTP deployment automation
  - `DEPLOYMENT_GUIDE.md`: Comprehensive deployment documentation

### Backend Services
- **Authentication**: JWT tokens with 8-hour expiration
- **Blog API**:
  - `GET /api/posts` - List posts (public: published only, admin: all)
  - `GET /api/posts/:slug` - Get single post by slug
  - `POST /api/posts` - Create new post (admin only)
  - `PUT /api/posts/:id` - Update post (admin only)
  - `DELETE /api/posts/:id` - Delete post (admin only)
- **Health Check**: `GET /api/health` - Server status endpoint

### Frontend Environment
- `VITE_API_BASE_URL`: Backend API endpoint configuration
- Default: `http://localhost:5000` for development

### Hosting
- **Frontend**: Hostinger shared hosting (public_html via `.htaccess` SPA routing)
- **Backend**: Requires separate Node.js hosting (Hostinger, Heroku, DigitalOcean, etc.)
- **Database**: MySQL on Hostinger or external provider

---

## Release Notes

### v1.0.0 MVP Features
✅ Terminal interface fully functional and preserved  
✅ GUI mode with complete content pages  
✅ Admin authentication and blog management  
✅ Production build optimized and ready  
✅ Deployment guides and automation scripts included  

### Next Version Priorities
- Email backend for contact form
- OAuth integration (GitHub, Google)
- Blog search and filtering
- Admin dashboard analytics
- Performance optimizations
- Mobile responsive improvements

---

**View deployment instructions**: See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)  
**View GitHub repository**: https://github.com/usmc1371nerd/network-portfolio
