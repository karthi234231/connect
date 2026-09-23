#!/bin/bash
# Connect - Local Development Bootstrap Script
# Usage: ./scripts/setup.sh

set -euo pipefail

echo "🚀 Connect Local Development Setup"
echo "=================================="

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js >=20.9.0"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//')
REQUIRED_VERSION="20.9.0"
if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $NODE_VERSION is below required $REQUIRED_VERSION"
    exit 1
fi
echo "✅ Node.js $NODE_VERSION"

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found"
    exit 1
fi
echo "✅ npm $(npm -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm ci

# Environment setup
echo ""
echo "⚙️  Setting up environment..."
if [ ! -f .env.local ]; then
    if [ -f .env.example ]; then
        cp .env.example .env.local
        echo "✅ Created .env.local from .env.example"
        echo "⚠️  Please edit .env.local with your configuration"
    else
        echo "❌ .env.example not found"
        exit 1
    fi
else
    echo "✅ .env.local already exists"
fi

# Database setup (optional - requires Supabase CLI)
echo ""
echo "🗄️  Database setup..."
if command -v supabase &> /dev/null; then
    echo "Supabase CLI found. Run 'npm run db:migrate' to apply migrations."
    echo "   Or run 'supabase start' for local development stack."
else
    echo "⚠️  Supabase CLI not found. Install from https://supabase.com/docs/guides/cli"
    echo "   You'll need a linked Supabase project or local stack for database."
fi

# Verify setup
echo ""
echo "🔍 Verifying setup..."
npm run typecheck > /dev/null 2>&1 && echo "✅ Typecheck passes" || echo "⚠️  Typecheck has issues - run 'npm run typecheck' for details"
npm run lint > /dev/null 2>&1 && echo "✅ Lint passes" || echo "⚠️  Lint has issues - run 'npm run lint' for details"

echo ""
echo "=================================="
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env.local with your Supabase credentials"
echo "  2. Run 'npm run db:migrate' to apply database migrations"
echo "  3. Run 'npm run dev' to start the development server"
echo "  4. Open http://localhost:3000"
echo ""
echo "Useful commands:"
echo "  npm run check       - Run all quality gates (lint + typecheck + test + build)"
echo "  npm run test        - Run unit tests"
echo "  npm run test:watch  - Run tests in watch mode"
echo "  npm run format      - Format code with Prettier"
echo "  npm run db:reset    - Reset local database"