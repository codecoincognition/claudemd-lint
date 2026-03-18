THIS IS THE RULES FOR THE PROJECT. FOLLOW THEM EXACTLY.

use react. use typescript. use tailwind. use prisma. use next.js. use vercel. use github actions.

NEVER EVER use any. NEVER. I MEAN IT. If you use any I will reject the PR. any is banned. Do not use any under any circumstances. This means the TypeScript any type. Don't do it. Seriously.

ok so basically the project structure is like src has components and pages and utils and lib and server and api and types and hooks and context and providers and middleware and its all typescript

build: npm run build
dev: npm run dev
test: npm run test (we use vitest)
test: npm run test (use jest)
lint: npm run lint

make sure the code works. test everything. dont break things.

write good error handling. handle errors properly. make sure errors are handled. errors should be caught. always handle errors.

Files should be named correctly.

here are some old notes from when we started the project:
- used create-react-app initially but migrated to next.js
- the old webpack config is in /config/webpack.old.js
- we had a discussion about tabs vs spaces and decided on tabs
- actually we use spaces now, 2 spaces
- no wait I think its 4 spaces for python files
- Jake said we should use Prettier so lets do that
- UPDATE: Jake left the company

the api routes are in /src/pages/api/ because we were on Next.js Pages Router but now we use App Router so new routes go in /src/app/api/ but some old ones are still in pages/api/

IMPORTANT: Never commit .env files
IMPORTANT: Always run tests before pushing
IMPORTANT: Never commit .env files
IMPORTANT: Use conventional commits
IMPORTANT: Never commit .env files

for the database:
- we use PostgreSQL
- the schema is in prisma/schema.prisma
- old migrations are in /db/migrations/ (dont touch these)
- new migrations use prisma migrate
- the old MongoDB connection string might still be in the config somewhere, ignore it
- actually we also have a Redis cache, the config is in /src/config/redis.ts

styling rules:
- use Tailwind CSS
- never write custom CSS
- actually some components use CSS modules, thats fine
- the design system tokens are in /src/styles/tokens.css
- we also use styled-components in the legacy dashboard

try to keep things clean and organized. write good code. be careful. think before you code. consider edge cases. handle errors. write tests. keep it simple. follow best practices. use common sense.

when you are working on the frontend make sure to think about accessibility and performance and SEO and mobile responsiveness and cross-browser compatibility and also make sure the bundle size doesnt get too big and lazy load things when possible and use proper semantic HTML and dont forget about dark mode support

authentication:
- we use NextAuth.js
- the config is in /src/auth/[...nextauth].ts (old pages router path)
- new auth config should be in /src/app/api/auth/[...nextauth]/route.ts
- use JWT tokens
- refresh tokens expire after 7 days
- actually I think we changed it to 30 days
- social login: Google, GitHub, Apple
- API keys for service accounts

last updated sometime in 2025 I think
