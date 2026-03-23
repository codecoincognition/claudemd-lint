# claudemd-lint

Lint, validate, and score your CLAUDE.md files across 7 dimensions.

Every Claude Code user writes a CLAUDE.md. Nobody validates theirs. This tool changes that.

## Install

**As a Claude Code plugin (recommended):**

```bash
claude mcp add claudemd-lint -- npx claudemd-lint --mcp
```

**As a standalone CLI:**

```bash
git clone https://github.com/codecoincognition/claudemd-lint.git
cd claudemd-lint
npm install && npm run build
```

> **npm package coming soon** — `npx claudemd-lint` will work once published.

## What Can It Do?

| Command | What it does |
|---------|-------------|
| `claudemd-lint` | **Score** your CLAUDE.md across 7 dimensions (1-10 scale) |
| `claudemd-lint --init` | **Generate** a CLAUDE.md by scanning your project's configs, structure, and CI |
| `claudemd-lint --fix` | **Auto-fix** boilerplate, duplicates, filler phrases, and missing timestamps |
| `claudemd-lint --badge` | **Get a badge** URL for your README (green/yellow/red by score) |
| `claudemd-lint --mcp` | **Plugin mode** — adds lint/generate tools directly inside Claude Code |

### Generate a CLAUDE.md (no file yet?)

```bash
claudemd-lint --init                # Scans your project → writes CLAUDE.md
claudemd-lint --init --dry-run      # Preview first
```

Detects your language, framework, package manager, test runner, CI/CD, deploy target, database, and coding conventions. Output follows [Anthropic's best practices](https://docs.anthropic.com/en/docs/claude-code) — under 200 lines, no linter-rule duplication, TODO markers for sections that need your input.

### Score an existing CLAUDE.md

```bash
claudemd-lint                       # Score ./CLAUDE.md
claudemd-lint path/to/CLAUDE.md     # Score a specific file
claudemd-lint --discover            # Find and score all CLAUDE.md files in a monorepo
```

### Fix common problems automatically

```bash
claudemd-lint --fix                 # Fix and re-score
claudemd-lint --fix --dry-run       # Preview what would change
```

Removes boilerplate ("write clean code"), deduplicates, trims filler phrases ("in order to" → "to"), adds timestamps, marks vague rules for review.

### Use as a Claude Code plugin

```bash
claude mcp add claudemd-lint -- npx claudemd-lint --mcp
```

Gives Claude three tools: `lint_claudemd`, `discover_claudemd`, and `init_claudemd` — so it can score, find, and generate CLAUDE.md files during your sessions.

### Add to CI

```yaml
# .github/workflows/claudemd-lint.yml
- uses: codecoincognition/claudemd-lint@main
  with:
    threshold: "6"  # Fail PR if score drops below 6/10
```

### Add a badge to your README

```bash
claudemd-lint --badge               # → Shields.io URL
claudemd-lint --score-only          # → just "8.2" (for scripting)
```

![CLAUDE.md Score](https://img.shields.io/badge/CLAUDE.md-8.2%2F10-brightgreen)

---

## The 7 Dimensions

claudemd-lint scores your CLAUDE.md across these dimensions:

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

## All CLI Options

```bash
claudemd-lint                      # Lint ./CLAUDE.md
claudemd-lint path/to/CLAUDE.md    # Lint a specific file
claudemd-lint --init               # Generate CLAUDE.md from project scan
claudemd-lint --init --dry-run     # Preview generated file
claudemd-lint --fix                # Auto-fix common issues
claudemd-lint --fix --dry-run      # Preview fixes
claudemd-lint --discover           # Find and lint all CLAUDE.md in monorepo
claudemd-lint --badge              # Shields.io badge URL
claudemd-lint --score-only         # Just the number
claudemd-lint --json               # JSON output
claudemd-lint --ci                 # GitHub Actions annotations
claudemd-lint --mcp                # Start MCP server
claudemd-lint --help               # Show help
```

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
