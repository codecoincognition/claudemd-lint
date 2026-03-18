<!-- No last-updated date -->

## Project Overview

This is a project. We do stuff. Things happen. It's good.

## Rules

- Be good at coding
- Try your best
- Don't write bad code
- Use `src/services/auth-handler.ts` for authentication logic
- Config lives in `config/database.yml`
- See `docs/architecture.md` for the full system design
- Deployment runbook: `ops/runbook/deploy-prod.md`
- Legacy migration script: `scripts/migrate-v1-to-v2.py`

## Code Style

- Always use semicolons
- Never use semicolons
- Prefer tabs over spaces
- Use 2-space indentation (no tabs)
- Always write JSDoc for every function
- Don't add unnecessary comments or docstrings

## Testing

- Always write unit tests for every function
- Don't write tests for simple utility functions
- Mock the database in tests
- Never mock the database — use real connections
- Run tests with `npm test`
- Run tests with `yarn test`

## Dependencies

- We use React 16 for the frontend
- Upgrade to React 18 hooks where possible
- We use `express@4.17.1` — do not upgrade
- Use the latest version of all dependencies
- Check `package-lock.json` for pinned versions
- Lodash is banned — use native JS
- Import helpers from `lodash/fp` when needed

## Deployment

- Deploy with `kubectl apply -f k8s/deployment.yaml`
- We don't use Kubernetes anymore, use Terraform
- Push to main triggers auto-deploy
- Never push directly to main — use PRs only
- The CI pipeline is in `.github/workflows/deploy.yml`
- Rollback script: `ops/rollback.sh`

## Architecture

- The API gateway is at `src/gateway/index.ts`
- Database models in `src/models/`
- Use the shared utils in `lib/shared/utils.ts`
- Event bus config: `infrastructure/event-bus.tf`
- Secrets stored in `vault/secrets.enc.yaml`

## Miscellaneous

- Be nice
- Have fun
- Think before you code
- Use common sense
- Remember to breathe
- Stay hydrated
- Touch grass occasionally
