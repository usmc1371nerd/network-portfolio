param(
    [ValidateSet('patch', 'minor', 'major')]
    [string]$Type = 'patch',

    [string]$ApiHealthUrl = 'https://api.jpsportfolio.com/api/health'
)

$ErrorActionPreference = 'Stop'

Write-Host "Starting release process ($Type)" -ForegroundColor Cyan

powershell -ExecutionPolicy Bypass -File .\bump-version.ps1 -type $Type

$package = Get-Content .\package.json -Raw | ConvertFrom-Json
$version = $package.version
$tag = "v$version"

git add package.json
git commit -m "chore: $tag - automated release"
git tag $tag

npm run build

git push origin master --tags

Write-Host "Waiting for deployment to settle..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

try {
    $health = Invoke-RestMethod -Uri $ApiHealthUrl -Method Get -TimeoutSec 20
    if (-not $health.ok) {
        throw "Health endpoint returned ok=false"
    }

    Write-Host "Release successful. $tag is live and API is healthy." -ForegroundColor Green
} catch {
    Write-Host "Release push succeeded, but API health check failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}