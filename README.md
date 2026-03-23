# claudemd-lint

Lint, validate, and score your CLAUDE.md files across 7 dimensions.

Every Claude Code user writes a CLAUDE.md. Nobody validates theirs. This tool changes that.

## Quick Start

```bash
git clone https://github.com/codecoincognition/claudemd-lint.git
cd claudemd-lint
npm install
npm run build
node dist/bin/cli.js /path/to/your/CLAUDE.md
```

Or install locally and link for global usage:

```bash
npm link
claudemd-lint ./CLAUDE.md
```

> **npm package coming soon** — `npx claudemd-lint` will work once published to npm.

## Claude Code Integration (MCP)

Install as a Claude Code plugin with one command:

```bash
claude mcp add claudemd-lint -- npx claudemd-lint --mcp
```

This exposes three tools to Claude:

- **`lint_claudemd`** — Lint a CLAUDE.md file and return scores across 7 dimensions
- **`discover_claudemd`** — Find all CLAUDE.md files in a project hierarchy
- **`init_claudemd`** — Generate a CLAUDE.md by scanning your project's configs and structure

Once installed, Claude can automatically lint, generate, and improve your CLAUDE.md files during sessions.

## What It Does

claudemd-lint reads your CLAUDE.md (and child files in monorepos) and produces a scored report across 7 dimensions:

| Dimension | What It Checks |
|---|---|
| **Consistency** | Contradictory rules (e.g., "use pnpm" vs "run npm install") |
| **Staleness** | References to deleted files, deprecated tools, outdated patterns |
| **Redundancy** | Duplicate rules, generic boilerplate that adds no value |
| **Scope** | Monorepo hierarchy — is content relevant to this directory? |
| **Tokens** | Context window waste — word count, prose walls, verbose phrasing |
| **Actionability** | Vague rules Claude can't follow, rules that should be hooks |
| **Maintainability** | Missing sections, no timestamps, poor heading structure |

## Example Output

```
📊 CLAUDE.md Health Report
════════════════════════════════════════════════════════

  Score: 6.2/10 (Good)
  4,218 words · 312 lines · ~3,164 tokens

  CONSISTENCY    ████░░░░░░  4/10   2 contradictions found
  STALENESS      ████████░░  8/10   1 stale reference
  REDUNDANCY     ██████░░░░  6/10   3 boilerplate rules
  SCOPE          █████████░  9/10   Scope is well-defined
  TOKENS         ███████░░░  7/10   3,164 tokens (1.6% of context)
  ACTIONABILITY  █████░░░░░  5/10   2 vague rules, 3 hook candidates
  MAINTAIN       ██████░░░░  6/10   5/8 recommended sections present

❌ ERRORS (2)
  Contradictory package manager instructions (line 14)
    → Line 14: "Use pnpm for all installs" conflicts with Line 87: "Run npm install"

⚠️  WARNINGS (3)
  Vague rule: "Handle errors properly" (line 23)
    → Too vague — specify the pattern (e.g., 'wrap all async calls in try/catch')

🔧 MIGRATE TO HOOKS
  Line 45: Rule should be a PostToolUse hook: "Always run prettier after editing"
  Line 67: Rule should be a PreToolUse hook: "Tests must pass before committing"

════════════════════════════════════════════════════════
claudemd-lint v0.1.0 · github.com/codecoincognition/claudemd-lint
```

## CLI Options

```bash
claudemd-lint                      # Lint ./CLAUDE.md
claudemd-lint path/to/CLAUDE.md    # Lint a specific file
claudemd-lint --discover           # Find and lint all CLAUDE.md files in monorepo
claudemd-lint --json               # Output as JSON (for CI/CD pipelines)
claudemd-lint --ci                 # Output GitHub Actions annotations
claudemd-lint --init               # Generate CLAUDE.md from your project
claudemd-lint --init --dry-run     # Preview generated CLAUDE.md
claudemd-lint --fix                # Auto-fix common issues and re-lint
claudemd-lint --fix --dry-run      # Preview fixes without writing
claudemd-lint --help               # Show help
```

## The 7 Dimensions

### 1. Consistency

Detects contradictory instructions within the same file. Checks for conflicting package managers, async patterns, auth strategies, code style rules, and more.

### 2. Staleness

Cross-references against your codebase. Flags references to deleted files, deprecated tools (create-react-app, TSLint, Enzyme), and packages not in your package.json.

### 3. Redundancy

Finds duplicate rules, overlapping instructions, and generic boilerplate ("write clean code", "follow best practices") that Claude already does without being told.

### 4. Scope Specificity

For monorepos: checks whether root CLAUDE.md contains service-specific content that should be in subdirectory files. Flags duplicated content between parent and child files.

### 5. Token Efficiency

Measures context window impact. Flags files over the 10K word ceiling, detects prose walls (500+ word sections with no structure), and identifies verbose phrasing.

### 6. Actionability

Classifies rules as directives vs. guidelines. Flags vague rules ("handle errors properly") and identifies rules that should be Claude Code hooks instead (e.g., "never commit .env" → PreToolUse hook).

### 7. Maintainability

Checks for recommended sections (project structure, build commands, testing, coding conventions, error handling, naming, deployment). Flags missing timestamps, heading hierarchy issues, and poor organization.

## Auto-Fix Mode

`--fix` automatically repairs common issues and re-lints to show the improvement:

```bash
claudemd-lint --fix                # Fix and write back
claudemd-lint --fix --dry-run      # Preview what would change
```

What it fixes:
- **Boilerplate removal** — deletes generic rules Claude already follows ("write clean code", "follow best practices")
- **Duplicate removal** — removes exact duplicate lines (keeps first occurrence)
- **Filler trimming** — rewrites verbose phrases ("it is important to" → removed, "in order to" → "to")
- **Whitespace cleanup** — collapses 3+ blank lines to 2
- **Timestamp insertion** — adds `Last updated: YYYY-MM-DD` if missing
- **Vague rule markers** — appends `<!-- TODO: make this more specific -->` to vague rules for manual review

Fixes are conservative — they preserve file structure, headings, and section order.

## Generate from Scratch

Don't have a CLAUDE.md yet? `--init` scans your project and generates one:

```bash
claudemd-lint --init               # Generate and write CLAUDE.md
claudemd-lint --init --dry-run     # Preview without writing
```

What it detects:
- **Languages** — TypeScript, Python, Go, Rust, Java, Ruby, Elixir, Swift
- **Frameworks** — Next.js, React, Vue, Angular, Express, FastAPI, Django, Gin, Axum, and more
- **Package manager** — npm, pnpm, yarn, bun, Poetry, PDM (from lock files)
- **Build/test/lint commands** — from package.json scripts, go.mod, Cargo.toml
- **Coding conventions** — from .prettierrc, .editorconfig, tsconfig.json
- **CI/CD** — GitHub Actions, GitLab CI, CircleCI, Jenkins
- **Deployment** — Vercel, Netlify, Fly.io, Railway, Docker
- **Database** — PostgreSQL, MySQL, SQLite, MongoDB, Redis (via Prisma or driver packages)

Generated files follow [Anthropic's best practices](https://docs.anthropic.com/en/docs/claude-code): under 200 lines, no linter-rule duplication, concrete instructions, and TODO markers for sections that need human input.

## Score Badge

Add a CLAUDE.md quality badge to your README:

```bash
claudemd-lint --badge              # Get Shields.io badge URL
claudemd-lint --score-only         # Just the number (for scripting)
```

Output:
```
![CLAUDE.md Score](https://img.shields.io/badge/CLAUDE.md-8.2%2F10-brightgreen)
```

Colors: green (8+), yellow (6-7.9), red (<6).

## GitHub Action

Add quality gates to PRs that touch your CLAUDE.md:

```yaml
# .github/workflows/claudemd-lint.yml
name: CLAUDE.md Quality
on:
  pull_request:
    paths: ["CLAUDE.md", ".claude/**"]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: codecoincognition/claudemd-lint@main
        with:
          threshold: "6"  # Fail if score drops below 6/10
```

The action posts GitHub annotations on warnings/errors and fails the check if the score is below your threshold.

## Try It on a Broken File

Want to see what the linter catches? Run it against the intentionally broken fixture:

```bash
node dist/bin/cli.js fixtures/broken.md
```

This file is packed with common CLAUDE.md mistakes:
- "Always use semicolons" vs "Never use semicolons"
- "Mock the database" vs "Never mock the database"
- "Lodash is banned" vs "Import from lodash/fp"
- "Do not upgrade express" vs "Use the latest version of all dependencies"
- "Push to main triggers auto-deploy" vs "Never push directly to main"
- 11 references to files that don't exist
- Generic filler rules like "Use common sense" and "Stay hydrated"

Compare it against your own file to see where you stand.

## Fixtures

The `fixtures/` directory contains example CLAUDE.md files for testing:

- `good.md` — Well-structured, specific, maintainable (scores 8+/10)
- `bad.md` — Common problems: contradictions, staleness, vague rules (scores 4-6/10)
- `ugly.md` — Everything wrong: bloat, all-caps, no structure, duplicates (scores 2-4/10)
- `broken.md` — Deliberately contradictory, stale refs, boilerplate (scores ~6/10)

## Programmatic API

```typescript
import { lint, fix, generate, formatTerminal, DEFAULT_CONFIG } from "claudemd-lint";

// Generate a CLAUDE.md from your codebase
const gen = generate(process.cwd());
console.log(gen.content);    // The generated markdown
console.log(gen.summary);    // "Detected: TypeScript, Next.js, npm, ..."

// Lint an existing CLAUDE.md
const report = lint("./CLAUDE.md", {
  ...DEFAULT_CONFIG,
  rootDir: process.cwd(),
});
console.log(formatTerminal(report));

// Auto-fix common issues
const result = fix(fileContent, report.findings);
console.log(result.summary); // "Removed 3 boilerplate line(s), ..."
```

## Roadmap

- [x] `--fix` mode that rewrites common issues
- [x] `--init` mode that generates CLAUDE.md from codebase scanning
- [x] GitHub Action for PR quality gates
- [x] Score badge for READMEs (`--badge`)
- [x] MCP server for Claude Code integration (`--mcp`)
- [ ] VS Code extension with inline diagnostics
- [ ] `.claudelintrc.json` config file for custom rules and weights
- [ ] Monorepo hierarchy visualization

## Contributing

Contributions welcome. Open an issue or PR.

## License

MIT — Code Coin Cognition LLC
