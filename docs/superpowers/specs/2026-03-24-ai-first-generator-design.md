# AI-First CLAUDE.md Generator — Design Spec

**Date:** 2026-03-24
**Status:** Approved

## Problem

The current generator (`claudemd-lint --init`) is a static dependency scanner. It reads package.json, matches dep names to labels, and dumps them into a flat list. It produces mechanically correct but shallow output:

- Architecture section is a dependency dump, not actual architecture
- Can't detect service patterns (factory, adapter, fallback chains)
- Can't distinguish used vs unused deps (lists Passport.js even if never imported)
- Env var `required` flags are often wrong (marks platform-specific vars as required)
- Directory descriptions are generic ("Service layer" instead of "AI model integrations")
- No understanding of domain context or how components connect

The fitcheckai project exposed this clearly: the generator listed 14 architecture bullet points but missed the core design — a pluggable AI model system with Gemini/Llava/OpenAI + mock fallback chain.

## Solution

Two generation modes sharing the same codebase:

### Mode 1: AI-First (default, inside Claude Code)

A `/claudemd-init` slash command skill that orchestrates Claude to:
1. Call a lightweight MCP tool for file tree + raw configs
2. Read source files directly using Claude Code's built-in tools
3. Synthesize a CLAUDE.md using a baked-in rubric covering the 7 scoring dimensions

Claude's intelligence handles architecture understanding, relationship mapping, gotcha detection, and domain context. No extra API keys needed — piggybacks on the existing Claude Code session.

### Mode 2: Deterministic (CLI fallback, outside Claude Code)

`npx claudemd-lint --init` from a regular terminal. Uses the improved static scanner (current v2 logic). No AI session available, so it generates directly from rules. Still useful, still free, just less intelligent.

## Architecture

### Component Overview

```
User types /claudemd-init in Claude Code
  |
  v
Skill prompt loads (generation instructions + rubric + anti-patterns)
  |
  v
Claude calls init_claudemd MCP tool
  |
  v
MCP tool returns:
  - File tree (2 levels deep)
  - Raw config file contents (package.json, tsconfig, pyproject.toml, etc.)
  |
  v
Claude reads source files itself (entry points, services, routes, schemas)
  |
  v
Claude synthesizes CLAUDE.md following the rubric
  |
  v
Claude writes CLAUDE.md to disk
```

### MCP Tool: `init_claudemd` (simplified)

The MCP tool becomes a thin data collector. Returns a structured response:

```typescript
interface InitResponse {
  projectRoot: string;              // absolute path
  fileTree: string;                 // 2-level directory listing with file names
  configs: Record<string, string>;  // filename -> raw contents
  existingClaudeMd: boolean;        // whether CLAUDE.md already exists
}
```

**Config files collected** (if they exist):
- `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod`
- `tsconfig.json`
- `.env.example` / `.env.development`
- `drizzle.config.ts` / `prisma/schema.prisma`
- `.replit` / `vercel.json` / `Dockerfile` / `docker-compose.yml`
- CI files (`.github/workflows/*.yml`, `.gitlab-ci.yml`)

~3-5K tokens. Just enough for Claude to orient and know where to look next.

**Breaking change:** The current `init_claudemd` returns generated markdown. The new version returns raw data. Since we're pre-1.0 (v0.2.0) with minimal external consumers, this is acceptable. The deterministic generator remains available via `--init` CLI flag.

### Skill Delivery: MCP Prompts

The generation prompt + rubric is delivered as an **MCP prompt** registered by the MCP server — not a separate file. When the user connects the MCP server (`claude mcp add claudemd-lint ...`), the prompt is automatically available. No file copying, no separate install step, no npm distribution issues.

```typescript
// In src/mcp.ts
server.prompt(
  "claudemd-init",
  "Generate an AI-powered CLAUDE.md by deeply reading the project codebase",
  { directory: z.string().optional().describe("Project root directory") },
  async ({ directory }) => {
    // Returns the full generation prompt + rubric + instructions
    // Claude sees this as a prompt template it can execute
  }
);
```

This solves skill registration cleanly: the prompt lives in the MCP server code, ships via npm, and requires zero user setup beyond the existing `claude mcp add` command.

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| CLAUDE.md already exists | MCP tool sets `existingClaudeMd: true`. Prompt instructs Claude to ask the user: overwrite, merge, or cancel. |
| MCP tool not installed | `/claudemd-init` skill can still work — it tells Claude to use `Read`, `Glob`, `Grep` directly instead of the MCP tool. MCP is a fast shortcut, not a hard dependency. |
| Huge monorepo (1000+ files) | File tree capped at 3 levels, 200 entries max. Prompt includes heuristic: "read at most 20 source files, prioritize entry points, services, routes, and schemas." |
| No package.json / no config files | Prompt handles gracefully — Claude falls back to reading the file tree and source files directly to infer the stack. |
| Non-JS/TS projects (Python, Go, Rust) | MCP tool collects `pyproject.toml` / `go.mod` / `Cargo.toml`. Prompt is language-agnostic — the understanding checklist works for any stack. |

### MCP Prompt: `claudemd-init`

The prompt is the core product. It contains:

#### Phase 1: Orientation
Instructions for Claude to read files in this order:
1. File tree (from MCP tool response)
2. README.md — project identity and purpose
3. Package config — deps, scripts, metadata
4. Entry points — `server/index.ts`, `app.ts`, `main.py`
5. Service/business logic files
6. Route/controller files
7. Schema/model files (Drizzle, Prisma, Zod, etc.)
8. Config files (build, deploy, CI)
9. `.env.example` for env vars

#### Phase 2: Understanding Checklist
What Claude must extract and understand:
- **Project identity:** What is this? Who is it for? What makes it unique?
- **Tech stack with purpose:** Not just "Express" but "Express for REST API serving AI analysis results"
- **Architecture as narrative:** How components connect. Service patterns. Data flows. "Pluggable AI backend with Gemini/Llava/OpenAI fallback chain" — not "Google Gemini AI for text/image generation, OpenAI API for AI-powered features"
- **Every script:** What it does, when to use it
- **Env vars:** Which are required, which are optional, which unlock which features. Infer from actual usage, not just presence in `.env.example`
- **API surface:** Endpoints with method, path, what they accept, what they return
- **Database:** Tables, relationships, is it optional? What's the fallback?
- **Deployment:** Platform, constraints, required setup steps
- **Real gotchas:** From reading the code — not generic patterns. "Port 5000 is hardcoded for Replit" not "consider rate limiting"

#### Phase 3: 7-Dimension Rubric

The skill embeds scoring criteria so Claude optimizes for them:

**1. Consistency (no contradictions)**
- Don't mention conflicting tools, patterns, or approaches
- If the project uses npm, don't reference yarn anywhere
- If env vars are optional, don't mark them required

**2. Staleness (no dead references)**
- Only reference files, functions, and patterns that actually exist in the codebase
- Don't mention features that are placeholder/unimplemented without flagging them

**3. Redundancy (no duplication)**
- Say things once. Don't repeat the project description in overview AND architecture
- Don't list the same dep in architecture AND a separate tools section

**4. Scope Specificity (relevant to this project)**
- Every line should be specific to THIS project, not generic advice
- "Wrap async in try/catch" is generic. "AI model responses must validate against analysisResultSchema (Zod) — malformed JSON from Llava will throw" is specific

**5. Token Efficiency (concise)**
- Target under 200 lines
- Use tables for structured data (env vars, endpoints, scripts)
- No prose walls — prefer bullet points and code blocks
- Don't explain what Claude already knows (TypeScript syntax, React patterns)

**6. Actionability (Claude can act on every rule)**
- Every instruction should be something Claude can follow mechanically
- "Handle errors properly" is vague. "API routes return `{ error: string }` with HTTP 4xx/5xx" is actionable
- Include actual file paths, function names, patterns

**7. Maintainability (well-structured, timestamped)**
- Clear heading hierarchy
- Logical section order: overview → commands → structure → architecture → API → env → gotchas
- Include `Last updated:` timestamp

#### Phase 4: Anti-Patterns

Explicit instructions on what NOT to do:
- Don't dump a flat list of dependencies as "architecture"
- Don't mark all env vars as required
- Don't include deps that aren't actually imported/used in the code
- Don't write generic rules ("write clean code", "follow best practices")
- Don't write for human developers — write for Claude as the primary reader
- Don't add empty TODO placeholders
- Don't include boilerplate error handling / naming convention sections unless the project has specific conventions
- Don't over-explain standard framework behavior

#### Phase 5: Output Format

The CLAUDE.md structure template:
```markdown
# {Project Name}

{One-line description from README or inferred}

{Language}, {Framework}, {Key lib} project.

## Build and Dev Commands
{Table or bullet list — every script, what it does}

## Project Structure
{Directory tree with meaningful descriptions}

## Architecture
{Narrative — how components connect, key patterns, data flows}

## API Endpoints
{Table: method, path, input, output, purpose}

## Environment Variables
{Table: name, required?, default, what it unlocks}

## Database
{Engine, schema location, tables with columns, optional/required}

## Common Gotchas
{Specific to this project — things that will trip Claude up}

## Deployment
{Platform, port, build steps, pre-deploy checklist}

## Testing
{Framework, how to run, patterns}

## Coding Conventions
{Only if project-specific — not generic rules}

Last updated: {date}
```

Not every section is required. If a project has no database, skip it. If there are no gotchas, skip it. The template is a guide, not a mandate.

## What Changes in the Codebase

### Modified Files

| File | Change |
|------|--------|
| `src/mcp.ts` | Add `claudemd-init` MCP prompt with full rubric. Simplify `init_claudemd` tool to return raw data (file tree + configs). |
| `src/generator.ts` | Keep deterministic generator for CLI mode. Extract `scanFileTree()` and `collectConfigs()` into `src/scanner.ts` for shared use by both MCP tool and generator. |

### New Files

| File | Purpose |
|------|--------|
| `src/scanner.ts` | Shared file tree scanning + config collection logic, used by both `mcp.ts` and `generator.ts` |

### Unchanged

| File | Why |
|------|-----|
| `src/rules/*.ts` | Linting rules unchanged — they evaluate the output |
| `src/scorer.ts` | Scoring unchanged |
| `src/fixer.ts` | Auto-fix unchanged |
| `bin/cli.ts` | `--init` flag still triggers deterministic mode |

## Invocation

| Context | How | Mode |
|---------|-----|------|
| Inside Claude Code | User selects `claudemd-init` MCP prompt, or asks "generate a CLAUDE.md" | AI-first (MCP prompt + tool) |
| Terminal (no Claude) | `npx claudemd-lint --init` | Deterministic (static scanner) |

## Success Criteria

Running `/claudemd-init` on the fitcheckai project should produce a CLAUDE.md that:

1. Describes the pluggable AI model system with Gemini/Llava/OpenAI + mock fallback — not a flat dep list
2. Correctly marks `OPENAI_API_KEY` as conditional (only if `AI_MODEL=openai`), not required
3. Does NOT list Passport.js/WebSocket if they're not actually used
4. Describes `server/services/` as "AI model integrations (gemini.ts, llava.ts, openai.ts, ai-service.ts orchestrator)" not "Service layer"
5. Explains that database is optional with in-memory fallback
6. Notes port 5000 is hardcoded for Replit
7. Scores 8+ on all 7 linting dimensions
8. Is under 200 lines

## Token Budget

The AI-first mode consumes tokens from the user's Claude Code session:
- MCP tool response: ~3-5K tokens
- MCP prompt (rubric + instructions): ~2-3K tokens
- Claude reading source files: ~20-50K tokens (varies by project size)
- Generated CLAUDE.md: ~1-2K tokens

Total: ~30-60K tokens for a typical project. Well within Claude's context limits. The deterministic CLI mode uses zero AI tokens.

The prompt includes a heuristic: "read at most 20 source files, prioritize entry points, services, routes, and schemas" to prevent runaway reading on large projects.
