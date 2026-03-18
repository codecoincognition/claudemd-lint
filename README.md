# claudemd-lint

Lint, validate, and score your CLAUDE.md files across 7 dimensions.

Every Claude Code user writes a CLAUDE.md. Nobody validates theirs. This tool changes that.

## Quick Start

```bash
npx claudemd-lint
```

Or install globally:

```bash
npm install -g claudemd-lint
claudemd-lint ./CLAUDE.md
```

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

## Fixtures

The `fixtures/` directory contains example CLAUDE.md files for learning:

- `good.md` — Well-structured, specific, maintainable (scores 8+/10)
- `bad.md` — Common problems: contradictions, staleness, vague rules (scores 4-6/10)
- `ugly.md` — Everything wrong: bloat, all-caps, no structure, duplicates (scores 2-4/10)

## Programmatic API

```typescript
import { lint, formatTerminal, DEFAULT_CONFIG } from "claudemd-lint";

const report = lint("./CLAUDE.md", {
  ...DEFAULT_CONFIG,
  rootDir: process.cwd(),
});

console.log(formatTerminal(report));
console.log(`Score: ${report.overallScore}/10`);
```

## Roadmap

- [ ] GitHub Action for PR checks on CLAUDE.md changes
- [ ] VS Code extension with inline diagnostics
- [ ] `--fix` mode that rewrites common issues
- [ ] `.claudelintrc.json` config file for custom rules and weights
- [ ] Monorepo hierarchy visualization

## Contributing

Contributions welcome. Open an issue or PR.

## License

MIT — Code Coin Cognition LLC
