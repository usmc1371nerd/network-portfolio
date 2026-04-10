param(
    [ValidateSet('patch', 'minor', 'major')]
    [string]$type = 'patch'
)

# Get current version from package.json
$packagePath = Join-Path -Path (Get-Location) -ChildPath 'package.json'
$package = Get-Content $packagePath -Raw | ConvertFrom-Json
$version = [System.Version]$package.version

# Calculate new version
$newVersion = if ($type -eq 'patch') {
    "{0}.{1}.{2}" -f $version.Major, $version.Minor, ($version.Build + 1)
} elseif ($type -eq 'minor') {
    "{0}.{1}.0" -f $version.Major, ($version.Minor + 1)
} else {
    "{0}.0.0" -f ($version.Major + 1)
}

# Update version in package.json
$package.version = $newVersion
$json = $package | ConvertTo-Json -Depth 32
[System.IO.File]::WriteAllText($packagePath, $json)

Write-Host "✓ Version bumped from $($version) to $newVersion" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Review changes: git status"
Write-Host "  2. Stage version update: git add package.json"
Write-Host "  3. Commit: git commit -m 'chore: v$newVersion - [describe changes]'"
Write-Host "  4. Create tag: git tag v$newVersion"
Write-Host "  5. Build: npm run build"
Write-Host "  6. Push: git push origin main --tags"
Write-Host ""
Write-Host "Example commit message:" -ForegroundColor Yellow
Write-Host "  git commit -m 'chore: v$newVersion - Add new features'"
