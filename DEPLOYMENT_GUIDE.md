# Deployment & Versioning Pipeline

## Version Strategy: Semantic Versioning (SemVer)

This project uses Semantic Versioning (MAJOR.MINOR.PATCH):
- **MAJOR**: Breaking changes (e.g., new pages, major features)
- **MINOR**: New features, backward compatible (e.g., blog improvements, new admin tools)
- **PATCH**: Bug fixes (e.g., styling fixes, performance improvements)

Current version: **1.0.0**

## Deployment Workflow

### Step 1: Make Your Changes
1. Edit code in the project
2. Test locally with `npm run dev` (frontend) and backend separately

### Step 2: Bump the Version
Update `package.json` version and create a version tag:

```bash
# Option A: Manual bump (recommended)
# 1. Edit package.json and update "version" field
# 2. Commit with version message

# Example for patch fix (1.0.0 → 1.0.1):
git add package.json
git commit -m "chore: v1.0.1 - Fix CSS hover effects"
git tag v1.0.1

# Example for minor feature (1.0.0 → 1.1.0):
git add package.json
git commit -m "feat: v1.1.0 - Add email notifications to contact form"
git tag v1.1.0

# Example for major release (1.0.0 → 2.0.0):
git add package.json
git commit -m "chore: v2.0.0 - Restructure admin panel and add OAuth"
git tag v2.0.0
```

### Step 3: Build Production Bundle
```bash
cd /path/to/jp-network-lab
npm run build
# Output: dist/ folder ready
```

### Step 4: Push to GitHub
```bash
git push origin main --tags
# This pushes all commits and version tags
```

### Step 5: Deploy Frontend to Hostinger
1. Log in to Hostinger Control Panel
2. Navigate to **File Manager** → **public_html**
3. Delete old files (or backup first)
4. Upload contents of `dist/` folder (NOT the dist folder itself)
5. Ensure `.htaccess` is in root of public_html
6. Verify routes work: visit your domain, `/gui`, `/gui/projects`, etc.

### Step 6: Deploy Backend (if changes made)
1. SSH into your Hostinger server OR use Hostinger's Application Manager
2. Update backend code from git:
   ```bash
   cd ~/network-portfolio-api
   git pull origin main
   npm install
   # Create/update .env with DB credentials
   npm start
   ```
3. Or redeploy via Hostinger's Node.js hosting panel

## Commit Message Format

Follow this format for clear history:

```
type(scope): subject

body

footer
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `chore`: Maintenance, version bumps
- `docs`: Documentation
- `refactor`: Code restructuring (no behavior change)
- `style`: CSS/styling changes
- `perf`: Performance improvements

**Examples**:
```
feat(pages): add testimonials page to portfolio
fix(terminal): resolve SSH connection timeout issue
chore(deps): update React to 19.2.5
docs(deployment): update Hostinger instructions
style(cards): improve hover effect animation
perf(build): optimize bundle size with code splitting
```

## Quick Version Bump Script (Optional PowerShell)

Save this as `bump-version.ps1` in project root:

```powershell
param(
    [ValidateSet('patch', 'minor', 'major')]
    [string]$type = 'patch'
)

$package = Get-Content 'package.json' -Raw | ConvertFrom-Json
$version = [System.Version]$package.version

$newVersion = if ($type -eq 'patch') {
    "{0}.{1}.{2}" -f $version.Major, $version.Minor, ($version.Build + 1)
} elseif ($type -eq 'minor') {
    "{0}.{1}.0" -f $version.Major, ($version.Minor + 1)
} else {
    "{0}.0.0" -f ($version.Major + 1)
}

$package.version = $newVersion
$package | ConvertTo-Json -Depth 32 | Set-Content 'package.json'

Write-Output "Version bumped to $newVersion"
Write-Output "Next steps:"
Write-Output "  git add package.json"
Write-Output "  git commit -m 'chore: v$newVersion - [describe changes]'"
Write-Output "  git tag v$newVersion"
Write-Output "  git push origin main --tags"
```

**Usage**:
```bash
.\bump-version.ps1 -type minor
```

## GitHub Actions CI/CD (Optional)

To automate builds and deployments, create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Hostinger

on:
  push:
    tags:
      - 'v*'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install & Build
        run: |
          npm install
          npm run build
      
      - name: Deploy to Hostinger
        uses: SamKirkland/FTP-Deploy-Action@v4.3.4
        with:
          server: ${{ secrets.HOSTINGER_FTP_SERVER }}
          username: ${{ secrets.HOSTINGER_FTP_USER }}
          password: ${{ secrets.HOSTINGER_FTP_PASSWORD }}
          local-dir: ./dist/
          server-dir: /public_html/
          state-name: '.ftp-deploy-sync-state.json'
          dangerous-clean-slate: true
```

## Tracking Deployments

Keep a CHANGELOG.md:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-04-10
### Added
- Initial full-stack portfolio
- Terminal lab with network simulation  
- GUI mode with routing
- Admin blog system with JWT auth
- MySQL database integration

### Backend Hosting
- Hosted on: [your backend URL]
- Database: Hostinger MySQL

### Frontend Hosting  
- Hosted on: https://your-domain.com
```

## Rollback Procedure (if deployment breaks)

```bash
# View recent commits
git log --oneline -10

# Revert to previous version
git revert HEAD
git push origin main

# Or hard reset (careful!)
git reset --hard v1.0.0
git push origin main --force
```

## Summary

1. **Make changes** → Test locally
2. **Update version** in package.json
3. **Commit with version tag**: `git commit -m "chore: v1.X.X - description"` + `git tag v1.X.X`
4. **Build**: `npm run build`
5. **Push to GitHub**: `git push origin main --tags`
6. **Deploy**: Upload `dist/` to Hostinger public_html
7. **Verify**: Test all routes on live domain

Happy coding! 🚀
