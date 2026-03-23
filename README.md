<p align="center">
  <h1 align="center">claudemd-lint</h1>
</p>

<p align="center">
  <strong>Lint, validate, and score your CLAUDE.md files across 7 dimensions.</strong>
  <br>
  Every Claude Code user writes a CLAUDE.md. Nobody validates theirs. This tool changes that.
</p>

<br>

<p align="center">
  <a href="https://www.npmjs.com/package/@vikassah/claudemd-lint"><img src="https://img.shields.io/npm/v/@vikassah/claudemd-lint?color=blue&label=npm" alt="npm version"></a>
  <a href="https://github.com/codecoincognition/claudemd-lint/blob/main/LICENSE"><img src="https://img.shields.io/github/license/codecoincognition/claudemd-lint" alt="license"></a>
  <a href="https://github.com/codecoincognition/claudemd-lint/stargazers"><img src="https://img.shields.io/github/stars/codecoincognition/claudemd-lint?style=flat" alt="stars"></a>
  <img src="https://img.shields.io/node/v/@vikassah/claudemd-lint" alt="node version">
</p>

<br>

<p align="center">
  <a href="#install">Install</a> &middot;
  <a href="#what-can-it-do">Features</a> &middot;
  <a href="#the-7-dimensions">Dimensions</a> &middot;
  <a href="#programmatic-api">API</a> &middot;
  <a href="https://github.com/codecoincognition/claudemd-lint/issues">Issues</a>
</p>

<br>

---

<br>

## Install

<table>
<tr>
<td width="50%">

**Claude Code plugin** (recommended)

```bash
claude mcp add claudemd-lint -- npx @vikassah/claudemd-lint --mcp
```

</td>
<td width="50%">

**Standalone CLI**

```bash
npx @vikassah/claudemd-lint ./CLAUDE.md
```

</td>
</tr>
</table>

<br>

## What Can It Do?

<table>
<tr>
<td width="60"><strong>01</strong></td>
<td><strong>Score</strong> — Rate your CLAUDE.md across 7 dimensions on a 1-10 scale</td>
<td><code>claudemd-lint</code></td>
</tr>
<tr>
<td><strong>02</strong></td>
<td><strong>Generate</strong> — Scan your project and create a CLAUDE.md from scratch</td>
<td><code>claudemd-lint --init</code></td>
</tr>
<tr>
<td><strong>03</strong></td>
<td><strong>Fix</strong> — Auto-remove boilerplate, duplicates, and filler phrases</td>
<td><code>claudemd-lint --fix</code></td>
</tr>
<tr>
<td><strong>04</strong></td>
<td><strong>Plugin</strong> — Add lint/generate tools directly inside Claude Code</td>
<td><code>claudemd-lint --mcp</code></td>
</tr>
<tr>
<td><strong>05</strong></td>
<td><strong>Badge</strong> — Get a Shields.io badge URL for your README</td>
<td><code>claudemd-lint --badge</code></td>
</tr>
<tr>
<td><strong>06</strong></td>
<td><strong>CI</strong> — GitHub Action with configurable quality threshold</td>
<td><code>codecoincognition/claudemd-lint@main</code></td>
</tr>
</table>

<br>

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

❌ Contradictory package manager instructions (line 14)
⚠️  Vague rule: "Handle errors properly" (line 23)
🔧 Rule should be a PostToolUse hook: "Always run prettier after editing"
```

<br>

## Problems It Catches

<table>
<tr>
<th width="50%">What's in your CLAUDE.md</th>
<th width="50%">What claudemd-lint does</th>
</tr>
<tr>
<td>"Use pnpm" + "Run npm install"</td>
<td>Flags as <strong>contradictory package manager</strong> instructions</td>
</tr>
<tr>
<td>"Write clean code" / "Follow best practices"</td>
<td><strong>Removes</strong> — Claude already does this without being told</td>
</tr>
<tr>
<td>"Handle errors properly"</td>
<td>Flags as <strong>too vague</strong> — suggests specific patterns instead</td>
</tr>
<tr>
<td>"Never commit .env files"</td>
<td>Suggests migrating to a <strong>PreToolUse hook</strong> for enforcement</td>
</tr>
<tr>
<td>References to <code>/src/old-auth.ts</code></td>
<td>Flags as <strong>stale</strong> — file doesn't exist in codebase</td>
</tr>
<tr>
<td>"It is important to ensure that you always..."</td>
<td><strong>Trims filler</strong> — saves ~0.75 tokens per unnecessary word</td>
</tr>
<tr>
<td>10,000+ word CLAUDE.md</td>
<td>Warns about <strong>context window waste</strong> — suggests splitting</td>
</tr>
</table>

<br>

## The 7 Dimensions

| # | Dimension | What It Checks |
|---|-----------|---------------|
| 1 | **Consistency** | Contradictory rules (e.g., "use pnpm" vs "run npm install") |
| 2 | **Staleness** | References to deleted files, deprecated tools, outdated patterns |
| 3 | **Redundancy** | Duplicate rules, generic boilerplate that adds no value |
| 4 | **Scope** | Monorepo hierarchy — is content relevant to this directory? |
| 5 | **Tokens** | Context window waste — word count, prose walls, verbose phrasing |
| 6 | **Actionability** | Vague rules Claude can't follow, rules that should be hooks |
| 7 | **Maintainability** | Missing sections, no timestamps, poor heading structure |

<br>

## Generate from Scratch

No CLAUDE.md yet? `--init` scans your project and writes one:

```bash
claudemd-lint --init                # Scans project → writes CLAUDE.md
claudemd-lint --init --dry-run      # Preview first
```

<table>
<tr>
<th>What it detects</th>
<th>Sources</th>
</tr>
<tr><td>Languages</td><td>TypeScript, Python, Go, Rust, Java, Ruby, Elixir, Swift</td></tr>
<tr><td>Frameworks</td><td>Next.js, React, Vue, Angular, Express, FastAPI, Django, Gin, Axum, +more</td></tr>
<tr><td>Package manager</td><td>npm, pnpm, yarn, bun, Poetry, PDM (from lock files)</td></tr>
<tr><td>Commands</td><td>Build/test/lint from package.json, go.mod, Cargo.toml</td></tr>
<tr><td>Conventions</td><td>.prettierrc, .editorconfig, tsconfig.json</td></tr>
<tr><td>CI/CD</td><td>GitHub Actions, GitLab CI, CircleCI, Jenkins</td></tr>
<tr><td>Deploy</td><td>Vercel, Netlify, Fly.io, Railway, Docker</td></tr>
<tr><td>Database</td><td>PostgreSQL, MySQL, SQLite, MongoDB, Redis</td></tr>
</table>

Output follows [Anthropic's best practices](https://docs.anthropic.com/en/docs/claude-code) — under 200 lines, no linter-rule duplication, TODO markers for sections that need your input.

<br>

## CI & Badge

<table>
<tr>
<td width="50%">

**GitHub Action**

```yaml
# .github/workflows/claudemd-lint.yml
- uses: codecoincognition/claudemd-lint@main
  with:
    threshold: "6"
```

Fails the PR if score drops below your threshold.

</td>
<td width="50%">

**README Badge**

```bash
claudemd-lint --badge
```

![CLAUDE.md Score](https://img.shields.io/badge/CLAUDE.md-8.2%2F10-brightgreen)

Green (8+) &middot; Yellow (6-7.9) &middot; Red (<6)

</td>
</tr>
</table>

<br>

## Works With

<table>
<tr>
<td align="center" width="100"><strong>Claude Code</strong><br><sub>MCP plugin</sub></td>
<td align="center" width="100"><strong>GitHub</strong><br><sub>Actions CI</sub></td>
<td align="center" width="100"><strong>TypeScript</strong><br><sub>JS / TS</sub></td>
<td align="center" width="100"><strong>Python</strong><br><sub>pyproject</sub></td>
<td align="center" width="100"><strong>Go</strong><br><sub>go.mod</sub></td>
<td align="center" width="100"><strong>Rust</strong><br><sub>Cargo.toml</sub></td>
<td align="center" width="100"><strong>npm</strong><br><sub>npx</sub></td>
</tr>
</table>

<br>

<details>
<summary><strong>All CLI Options</strong></summary>

<br>

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

</details>

<details>
<summary><strong>Programmatic API</strong></summary>

<br>

```typescript
import { lint, fix, generate, formatTerminal, DEFAULT_CONFIG } from "@vikassah/claudemd-lint";

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

</details>

<details>
<summary><strong>Test Fixtures</strong></summary>

<br>

The `fixtures/` directory contains example CLAUDE.md files:

| File | Score | What it demonstrates |
|------|-------|---------------------|
| `good.md` | 8+/10 | Well-structured, specific, maintainable |
| `bad.md` | 4-6/10 | Contradictions, staleness, vague rules |
| `ugly.md` | 2-4/10 | Bloat, all-caps, no structure, duplicates |
| `broken.md` | ~6/10 | Deliberately contradictory, stale refs, boilerplate |

```bash
claudemd-lint fixtures/broken.md   # See what it catches
```

</details>

<br>

## Roadmap

- [x] Score across 7 dimensions
- [x] `--fix` auto-repair mode
- [x] `--init` generate from codebase
- [x] MCP server for Claude Code
- [x] GitHub Action for CI
- [x] Score badge for READMEs
- [ ] VS Code extension with inline diagnostics
- [ ] `.claudelintrc.json` custom rules and weights
- [ ] Monorepo hierarchy visualization

<br>

## Contributing

Contributions welcome. [Open an issue](https://github.com/codecoincognition/claudemd-lint/issues) or submit a PR.

---

<p align="center">
  <sub>Built by <a href="https://github.com/codecoincognition">Code Coin Cognition LLC</a></sub>
</p>
