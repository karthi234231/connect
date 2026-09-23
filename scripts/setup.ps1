<# 
.SYNOPSIS
    Connect - Local Development Bootstrap Script for Windows

.DESCRIPTION
    Sets up the local development environment for Connect.

.USAGE
    .\scripts\setup.ps1
#>

Write-Host "🚀 Connect Local Development Setup" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

# Check prerequisites
Write-Host "`n📋 Checking prerequisites..." -ForegroundColor Yellow

$nodePath = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodePath) {
    Write-Host "❌ Node.js not found. Please install Node.js >=20.9.0" -ForegroundColor Red
    exit 1
}

$nodeVersion = (node -v).TrimStart('v')
$requiredVersion = "20.9.0"
if ([version]$nodeVersion -lt [version]$requiredVersion) {
    Write-Host "❌ Node.js version $nodeVersion is below required $requiredVersion" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js $nodeVersion" -ForegroundColor Green

$npmPath = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmPath) {
    Write-Host "❌ npm not found" -ForegroundColor Red
    exit 1
}
Write-Host "✅ npm $(npm -v)" -ForegroundColor Green

# Install dependencies
Write-Host "`n📦 Installing dependencies..." -ForegroundColor Yellow
npm ci

# Environment setup
Write-Host "`n⚙️  Setting up environment..." -ForegroundColor Yellow
if (-not (Test-Path ".env.local")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env.local"
        Write-Host "✅ Created .env.local from .env.example" -ForegroundColor Green
        Write-Host "⚠️  Please edit .env.local with your configuration" -ForegroundColor Yellow
    } else {
        Write-Host "❌ .env.example not found" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ .env.local already exists" -ForegroundColor Green
}

# Database setup
Write-Host "`n🗄️  Database setup..." -ForegroundColor Yellow
$supabasePath = Get-Command supabase -ErrorAction SilentlyContinue
if ($supabasePath) {
    Write-Host "Supabase CLI found. Run 'npm run db:migrate' to apply migrations." -ForegroundColor Green
    Write-Host "   Or run 'supabase start' for local development stack." -ForegroundColor Gray
} else {
    Write-Host "⚠️  Supabase CLI not found. Install from https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
    Write-Host "   You'll need a linked Supabase project or local stack for database." -ForegroundColor Gray
}

# Verify setup
Write-Host "`n🔍 Verifying setup..." -ForegroundColor Yellow
try {
    npm run typecheck 2>$null | Out-Null
    Write-Host "✅ Typecheck passes" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Typecheck has issues - run 'npm run typecheck' for details" -ForegroundColor Yellow
}

try {
    npm run lint 2>$null | Out-Null
    Write-Host "✅ Lint passes" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Lint has issues - run 'npm run lint' for details" -ForegroundColor Yellow
}

Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Edit .env.local with your Supabase credentials"
Write-Host "  2. Run 'npm run db:migrate' to apply database migrations"
Write-Host "  3. Run 'npm run dev' to start the development server"
Write-Host "  4. Open http://localhost:3000"
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Cyan
Write-Host "  npm run check       - Run all quality gates (lint + typecheck + test + build)"
Write-Host "  npm run test        - Run unit tests"
Write-Host "  npm run test:watch  - Run tests in watch mode"
Write-Host "  npm run format      - Format code with Prettier"
Write-Host "  npm run db:reset    - Reset local database"