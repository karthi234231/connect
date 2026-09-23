# Contributing to Connect

Thank you for your interest in contributing to Connect! This document outlines the process for contributing to this project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please treat all contributors with respect.

## Getting Started

1. **Fork the repository** and clone your fork locally
2. **Install dependencies**: `npm ci`
3. **Set up environment**: Copy `.env.example` to `.env.local` and fill in values
4. **Run database migrations**: `npm run db:migrate`
5. **Start development server**: `npm run dev`

## Development Workflow

### Branching

- Use `feature/<description>` for new features
- Use `fix/<description>` for bug fixes
- Use `chore/<description>` for maintenance tasks
- Use `docs/<description>` for documentation changes

### Commits

Follow conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`

Example:
```
feat(chat): add message reactions

- Add reaction UI to thread view
- Wire realtime reaction events
- Add unit tests for reaction helpers

Closes #123
```

### Quality Gates

Before pushing, run the full check locally:

```bash
npm run check
```

This runs:
- `npm run lint` - ESLint with security rules
- `npm run typecheck` - TypeScript compilation check
- `npm run test` - Vitest unit tests
- `npm run build` - Next.js production build

The CI pipeline runs the same gates on Node 20.x and 24.x.

### Pre-commit Hooks

Husky + lint-staged are configured to run on commit:
- ESLint with auto-fix on staged TS/TSX/JS/JSX files
- Prettier formatting on all staged files

To skip hooks (not recommended): `git commit --no-verify`

## Pull Request Process

1. **Create a PR** against `main` with a clear title and description
2. **Link related issues** using `Closes #<number>` or `Refs #<number>`
3. **Ensure all CI checks pass** (lint, typecheck, test, build)
4. **Request review** from at least one maintainer
5. **Address review feedback** - resolve all conversations
6. **Merge** - squash and merge is preferred

### PR Template

Use the provided PR template (`.github/pull_request_template.md`) which includes:
- Description of changes
- Testing steps
- Screenshots (for UI changes)
- Checklist

## Coding Standards

### TypeScript

- Strict mode enabled - no `any` without justification
- Prefer `interface` over `type` for object shapes
- Use Zod schemas for all external input validation
- Export types from `types/` for cross-package sharing

### React/Next.js

- Server Components by default, Client Components only when needed
- Use existing design tokens (`--cx-*`) and `components/ui` primitives
- No new color literals or type scales - reuse the design system
- Follow the architecture: `app` → `services` → `lib` → `types`

### Testing

- Unit tests for pure logic (Vitest)
- Contract tests for API boundaries
- E2E tests for critical user flows (Playwright)
- SQL probes for database invariants

### Security

- All mutations go through Server Actions (CSRF-protected)
- Never trust client input - validate with Zod at every boundary
- RLS in Postgres + capability checks in `services/auth/capabilities.ts`
- Fail closed on optional integrations

## Documentation

- Update `README.md` for user-facing changes
- Update `CHANGELOG.md` using [Keep a Changelog](https://keepachangelog.com/) format
- Update `docs/ARCHITECTURE.md` for architectural decisions
- Add ADRs for significant design choices

## Reporting Issues

- Use the issue templates in `.github/ISSUE_TEMPLATE/`
- Include reproduction steps for bugs
- Tag security issues as `security` (they're handled privately)

## Release Process

Releases follow Semantic Versioning. The `CHANGELOG.md` is updated as part of each release.

---

For questions, check the documentation map in `README.md` or open a discussion.