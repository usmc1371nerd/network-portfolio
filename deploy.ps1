# Deployment Script for Hostinger
# Configuration: Update these variables with your Hostinger credentials

$FTP_SERVER = $env:HOSTINGER_FTP_SERVER   # e.g., "ftp.yoursite.com"
$FTP_USER = $env:HOSTINGER_FTP_USER       # e.g., "yoursite@ftp.com"
$FTP_PASSWORD = $env:HOSTINGER_FTP_PASSWORD
$FTP_REMOTE_PATH = "/public_html"          # Hostinger public_html path

# Local path
$LOCAL_DIST_PATH = Join-Path -Path (Get-Location) -ChildPath 'dist'
$PACKAGE = Get-Content 'package.json' -Raw | ConvertFrom-Json
$VERSION = $PACKAGE.version

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Network Portfolio Deployment Tool v1.0      " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Verify dist exists
if (-not (Test-Path $LOCAL_DIST_PATH)) {
    Write-Host "[-] Error: dist folder not found" -ForegroundColor Red
    Write-Host "  Run: npm run build" -ForegroundColor Yellow
    exit 1
}

Write-Host "[*] Preparing deployment..." -ForegroundColor Green
Write-Host "   Version: $VERSION"
Write-Host "   Source: $LOCAL_DIST_PATH"
Write-Host "   Target: ftp://$FTP_SERVER$FTP_REMOTE_PATH"
Write-Host ""

# Check for credentials
if (-not $FTP_SERVER -or -not $FTP_USER -or -not $FTP_PASSWORD) {
    Write-Host "[!] Error: FTP credentials not found in environment variables" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To set credentials, run:" -ForegroundColor Cyan
    Write-Host '$env:HOSTINGER_FTP_SERVER = "ftp.yoursite.com"' -ForegroundColor White
    Write-Host '$env:HOSTINGER_FTP_USER = "yoursite@ftp.com"' -ForegroundColor White
    Write-Host '$env:HOSTINGER_FTP_PASSWORD = "your_password"' -ForegroundColor White
    Write-Host ""
    Write-Host "Or update the variables in this script directly." -ForegroundColor Cyan
    exit 1
}

Write-Host "[*] Connecting to FTP server..." -ForegroundColor Green

# Create FTP session
try {
    $ftpUri = "ftp://$FTP_SERVER$FTP_REMOTE_PATH"
    $credential = New-Object System.Net.NetworkCredential($FTP_USER, $FTP_PASSWORD)
    
    # List remote files
    $ftpRequest = [System.Net.FtpWebRequest]::Create($ftpUri)
    $ftpRequest.Credentials = $credential
    $ftpRequest.Method = [System.Net.WebRequestMethods+Ftp]::ListDirectory
    
    $ftpResponse = $ftpRequest.GetResponse()
    Write-Host "[+] Connected successfully" -ForegroundColor Green
    $ftpResponse.Close()
} catch {
    Write-Host "[-] Connection failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[*] Uploading files..." -ForegroundColor Green
Write-Host ""

# Function to upload files recursively
function Upload-FilesRecursive {
    param(
        [string]$localPath,
        [string]$remotePath,
        [System.Net.NetworkCredential]$credential
    )
    
    $items = Get-ChildItem -Path $localPath
    foreach ($item in $items) {
        $remoteItemPath = "$remotePath/$($item.Name)"
        
        if ($item.PSIsContainer) {
            # Create directory on FTP
            try {
                $mkdirRequest = [System.Net.FtpWebRequest]::Create("ftp://$FTP_SERVER$remoteItemPath")
                $mkdirRequest.Credentials = $credential
                $mkdirRequest.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
                $mkdirResponse = $mkdirRequest.GetResponse()
                $mkdirResponse.Close()
            } catch {
                # Directory might already exist, continue
            }
            
            # Recursively upload contents
            Upload-FilesRecursive -localPath $item.FullName -remotePath $remoteItemPath -credential $credential
        } else {
            # Upload file
            try {
                $fileUri = "ftp://$FTP_SERVER$remoteItemPath"
                $fileRequest = [System.Net.FtpWebRequest]::Create($fileUri)
                $fileRequest.Credentials = $credential
                $fileRequest.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
                
                $fileStream = [System.IO.File]::OpenRead($item.FullName)
                $uploadStream = $fileRequest.GetRequestStream()
                $fileStream.CopyTo($uploadStream)
                $uploadStream.Close()
                $fileStream.Close()
                
                $response = $fileRequest.GetResponse()
                $response.Close()
                
                Write-Host "   [+] $($item.Name)" -ForegroundColor Green
            } catch {
                Write-Host "   [-] $($item.Name): $_" -ForegroundColor Red
            }
        }
    }
}

# Start upload
Upload-FilesRecursive -localPath $LOCAL_DIST_PATH -remotePath $FTP_REMOTE_PATH -credential $credential

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Deployment Complete!                        " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[+] Frontend deployed to: https://your-domain.com" -ForegroundColor Green
Write-Host "[+] Version: $VERSION" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Visit https://your-domain.com in browser"
Write-Host "  2. Test navigation (/, /gui, /gui/projects, etc.)"
Write-Host "  3. Hard refresh (Ctrl+Shift+R) if caching issues"
Write-Host ""
Write-Host "Troubleshooting:" -ForegroundColor Cyan
Write-Host "  - If 404 errors on routes, check .htaccess is in public_html"
Write-Host "  - Run: npm run build && .\deploy.ps1"
Write-Host "  - Check Hostinger File Manager for correct file permissions"
