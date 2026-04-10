# GitHub Secrets Configuration

To enable automatic deployment to Hostinger, configure these secrets in your GitHub repository:

## Setup Instructions

1. Go to: **https://github.com/usmc1371nerd/network-portfolio/settings/secrets/actions**

2. Click **"New repository secret"** and add these three secrets:

### 1. `HOSTINGER_FTP_SERVER`
- **Value**: Your Hostinger FTP server (e.g., `ftp.yoursite.com`)
- **Where to find**: Hostinger Control Panel → FTP Accounts or Account Settings

### 2. `HOSTINGER_FTP_USER`
- **Value**: Your FTP username (e.g., `yoursite@ftp.com` or `user@yoursite.com`)
- **Where to find**: Hostinger Control Panel → FTP Accounts

### 3. `HOSTINGER_FTP_PASSWORD`
- **Value**: Your FTP password
- **Where to find**: Hostinger Control Panel → FTP Accounts
- **⚠️ Security**: This password is encrypted and only used by GitHub Actions

## How It Works

Once secrets are configured, when you:

```bash
git push origin master --tags  # e.g., git push origin master --tags for v1.1.0
```

The workflow automatically:
1. ✅ Checks out code
2. ✅ Builds production bundle
3. ✅ Runs TypeScript check
4. ✅ Creates GitHub Release
5. ✅ **Deploys to Hostinger via FTP** (NEW!)

## Troubleshooting

**"Error: Authentication failed"**
- Verify FTP credentials in GitHub Secrets
- Test FTP connection locally: `ftp ftp.yoursite.com`

**"Error: Failed to upload files"**
- Ensure public_html directory exists on Hostinger
- Check FTP account has write permissions
- Verify `.htaccess` is being uploaded (needed for SPA routing)

**"Deployment succeeded but site still shows old content"**
- Force refresh in browser: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
- Check Hostinger File Manager to confirm files were uploaded
- Wait 5-10 minutes for any caching to clear

## Testing the Deployment

To test the workflow without deploying:

```bash
# Create a test tag locally
git tag v1.0.0-test

# Push to GitHub (won't deploy, only builds and creates release)
# Because deploy job has: needs: build && if: startsWith(github.ref, 'refs/tags/v')

# Delete test tag
git tag -d v1.0.0-test
git push origin :refs/tags/v1.0.0-test
```

## Rollback Procedure

If deployment goes wrong:

```bash
# Revert to previous version
git revert HEAD
git tag v1.0.1-fix
git push origin master --tags

# This will deploy the previous working version
```

## Security Notes

- ✅ Secrets are encrypted and never visible in logs
- ✅ Only admins can view/edit secrets
- ✅ Secrets are only used in this workflow
- ✅ FTP password is not stored in repository
- ✅ Each push to a new version tag triggers a fresh deployment

---

**Next Step**: Add the three GitHub Secrets, then create a version tag to test automatic deployment!
