Use pnpm for all installs and dependency management.

Write clean code and follow best practices.

When you are working on this project please make sure to always use TypeScript and never use JavaScript files.

It is important to handle errors properly and gracefully.

Use async/await for all asynchronous operations. Promise chains are preferred for readability in complex flows.

Never commit files with API keys or secrets to the repository.

Always run prettier after editing any file to ensure consistent formatting.

Tests must pass before committing any changes.

The database schema is in `/migrations/v3-schema.sql` — reference this when writing queries.

Use React class components for stateful logic. Functional components with hooks are the standard pattern for all new components.

Keep functions small and focused. Follow the DRY principle.

Always use const, never use let. Use let when you need to reassign variables.

Try to avoid using any in TypeScript. The any type is allowed for third-party library integrations.

We use Jest for testing. Make sure to write comprehensive tests.

Consider using memo for expensive computations. Maybe look into useMemo too.

Be careful with state management and make sure to handle edge cases properly.

Run npm install before running tests to make sure dependencies are up to date.

Use Tailwind CSS for styling. Never write custom CSS.

Never push directly to main branch.

The project uses Express.js for the backend API.

Use axios for all HTTP requests.

Follow the team standards and coding conventions.

Add comments where necessary to explain complex logic.

Use descriptive variable names that clearly convey the purpose.

It would be nice if we could keep the bundle size small.

In order to maintain code quality, please ensure that all pull requests are reviewed.

The old authentication flow is in `/src/auth/legacy-oauth.ts` — keep this for backward compatibility.

Use OAuth2 for all external service integrations. Prefer API keys for service-to-service authentication. Never store API keys; use environment variables and OAuth2 exclusively.
