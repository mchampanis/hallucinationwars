# Hallucination Wars - Windows Setup
# Run from project root: .\scripts\setup.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Hallucination Wars - Windows Setup ===" -ForegroundColor Cyan

# Check Node.js
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    Write-Host "[OK] Node.js $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "[!!] Node.js not found. Install from https://nodejs.org (LTS recommended)" -ForegroundColor Red
    exit 1
}

# Check npm
if (Get-Command npm -ErrorAction SilentlyContinue) {
    $npmVersion = npm --version
    Write-Host "[OK] npm $npmVersion" -ForegroundColor Green
} else {
    Write-Host "[!!] npm not found" -ForegroundColor Red
    exit 1
}

# Check git
if (Get-Command git -ErrorAction SilentlyContinue) {
    $gitVersion = git --version
    Write-Host "[OK] $gitVersion" -ForegroundColor Green
} else {
    Write-Host "[!!] git not found" -ForegroundColor Red
    exit 1
}

# Check VS Code
if (Get-Command code -ErrorAction SilentlyContinue) {
    Write-Host "[OK] VS Code found" -ForegroundColor Green

    # Install recommended extensions
    Write-Host "`nInstalling recommended VS Code extensions..." -ForegroundColor Cyan
    $extensions = @(
        "ms-vsliveshare.vsliveshare",
        "sumneko.lua",
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "editorconfig.editorconfig"
    )
    foreach ($ext in $extensions) {
        code --install-extension $ext --force
    }
    Write-Host "[OK] Extensions installed" -ForegroundColor Green
} else {
    Write-Host "[--] VS Code CLI not found (optional, install extensions manually)" -ForegroundColor Yellow
}

# Install npm dependencies (when package.json exists)
if (Test-Path "package.json") {
    Write-Host "`nInstalling npm dependencies..." -ForegroundColor Cyan
    npm install
    Write-Host "[OK] Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "[--] No package.json yet, skipping npm install" -ForegroundColor Yellow
}

Write-Host "`n=== Setup complete ===" -ForegroundColor Cyan
Write-Host "Next steps:"
Write-Host "  1. Open this folder in VS Code"
Write-Host "  2. Accept the recommended extensions prompt"
Write-Host "  3. Start a Live Share session or join one from your collaborator"
Write-Host "  4. Coordinate on Discord #github-hw"
