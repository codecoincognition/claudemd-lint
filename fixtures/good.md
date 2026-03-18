# Project Overview

This is a Next.js 14 app with TypeScript, Tailwind CSS, and Prisma ORM.

## Project Structure

- `src/app/` — Next.js App Router pages
- `src/components/` — React components (PascalCase filenames)
- `src/lib/` — Shared utilities and helpers
- `src/server/` — Server-side logic, API routes
- `prisma/` — Database schema and migrations

## Build & Run

- `npm run dev` — Start development server on port 3000
- `npm run build` — Production build
- `npm run test` — Run vitest test suite
- `npm run lint` — ESLint + Prettier check

## Coding Conventions

- Use functional components with hooks (no class components)
- Use `const` by default; `let` only when reassignment is needed
- Prefer named exports over default exports
- Use zod for all runtime validation
- All API routes return typed responses using `NextResponse.json()`

## Error Handling

- Wrap all async operations in try/catch
- Log errors to stderr with structured JSON: `console.error(JSON.stringify({ error, context }))`
- API routes return `{ error: string, code: string }` on failure
- Never expose stack traces in production responses

## File Naming

- Components: PascalCase (`UserProfile.tsx`)
- Utilities: camelCase (`formatDate.ts`)
- API routes: kebab-case directory (`api/user-profile/route.ts`)
- Test files: co-located as `*.test.ts`

## Testing

- Use vitest for unit tests
- Use Playwright for e2e tests in `tests/e2e/`
- Every new utility function needs a test
- Mock external services using msw

## Deployment

- Deploy via Vercel (auto-deploy on push to main)
- Environment variables in `.env.local` (never commit)
- Database migrations run automatically via `prisma migrate deploy`

Last updated: 2026-03-15
