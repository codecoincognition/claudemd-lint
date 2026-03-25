# AI-First CLAUDE.md Generator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-first CLAUDE.md generation via MCP prompt that leverages Claude's intelligence to read and understand a codebase, producing dramatically better output than static scanning.

**Architecture:** The MCP server registers a `claudemd-init` prompt containing the full generation rubric + 7-dimension scoring criteria. A simplified `init_claudemd` tool returns raw project data (file tree + config contents). Claude reads source files itself and synthesizes the CLAUDE.md. CLI `--init` remains as deterministic fallback.

**Tech Stack:** TypeScript, MCP SDK (`@modelcontextprotocol/sdk`), Zod, Node.js fs APIs

---

### Task 1: Extract shared scanner into `src/scanner.ts`

**Files:**
- Create: `src/scanner.ts`
- Modify: `src/generator.ts` (remove extracted functions, import from scanner)
- Modify: `src/index.ts` (export scanner)

- [ ] **Step 1: Create `src/scanner.ts` with `scanFileTree` and `collectConfigs`**

```typescript
/**
 * Scanner module — shared file tree and config collection logic.
 * Used by both the MCP tool (AI-first mode) and the deterministic generator (CLI mode).
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, basename } from "node:path";

export interface FileTreeEntry {
  path: string;       // relative path
  type: "file" | "dir";
  children?: FileTreeEntry[];
}

export interface ScanResult {
  projectRoot: string;
  fileTree: string;
  configs: Record<string, string>;
  existingClaudeMd: boolean;
}

const SKIP_DIRS = new Set([
  "node_modules", "dist", "build", ".git", ".next", ".nuxt", ".svelte-kit",
  "__pycache__", ".venv", "venv", "env", ".env", "target", "coverage",
  ".cache", ".turbo", ".vercel", ".output", "attached_assets",
]);

const CONFIG_FILES = [
  "package.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "tsconfig.json",
  ".env.example",
  ".env.development",
  "drizzle.config.ts",
  "drizzle.config.js",
  "prisma/schema.prisma",
  ".replit",
  "vercel.json",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
];

function readText(filePath: string): string | null {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Build a human-readable file tree string, 2 levels deep with files, 3 levels for dirs.
 * Capped at 200 entries to avoid token blow-up on monorepos.
 */
export function scanFileTree(rootDir: string, maxEntries = 200): string {
  const lines: string[] = [];
  let count = 0;

  function walk(dir: string, prefix: string, depth: number) {
    if (depth > 2 || count >= maxEntries) return;
    try {
      const items = readdirSync(dir, { withFileTypes: true })
        .filter(item => {
          if (item.name.startsWith(".") && item.name !== ".github" && item.name !== ".env.example") return false;
          if (SKIP_DIRS.has(item.name)) return false;
          return true;
        })
        .sort((a, b) => {
          // Directories first, then files
          if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      for (const item of items) {
        if (count >= maxEntries) {
          lines.push(`${prefix}... (truncated, ${maxEntries} entries shown)`);
          return;
        }
        const isDir = item.isDirectory();
        lines.push(`${prefix}${isDir ? item.name + "/" : item.name}`);
        count++;
        if (isDir) {
          walk(resolve(dir, item.name), prefix + "  ", depth + 1);
        }
      }
    } catch { /* permission denied */ }
  }

  lines.push(`${basename(rootDir)}/`);
  walk(rootDir, "  ", 0);
  return lines.join("\n");
}

/**
 * Collect raw config file contents. Also scans for CI workflow files.
 */
export function collectConfigs(rootDir: string): Record<string, string> {
  const configs: Record<string, string> = {};

  for (const file of CONFIG_FILES) {
    const content = readText(resolve(rootDir, file));
    if (content) {
      configs[file] = content;
    }
  }

  // CI workflow files
  const ghWorkflowDir = resolve(rootDir, ".github", "workflows");
  try {
    if (existsSync(ghWorkflowDir) && statSync(ghWorkflowDir).isDirectory()) {
      for (const f of readdirSync(ghWorkflowDir)) {
        if (f.endsWith(".yml") || f.endsWith(".yaml")) {
          const content = readText(resolve(ghWorkflowDir, f));
          if (content) {
            configs[`.github/workflows/${f}`] = content;
          }
        }
      }
    }
  } catch { /* */ }

  // GitLab CI
  const gitlabCi = readText(resolve(rootDir, ".gitlab-ci.yml"));
  if (gitlabCi) configs[".gitlab-ci.yml"] = gitlabCi;

  return configs;
}

/**
 * Full scan for MCP tool — returns file tree, configs, and metadata.
 */
export function scanProjectRaw(rootDir: string): ScanResult {
  const absRoot = resolve(rootDir);
  return {
    projectRoot: absRoot,
    fileTree: scanFileTree(absRoot),
    configs: collectConfigs(absRoot),
    existingClaudeMd: existsSync(resolve(absRoot, "CLAUDE.md")),
  };
}
```

- [ ] **Step 2: Update `src/generator.ts` to import shared `readText` from scanner**

In `src/generator.ts`, the local `readText` function (lines 207-212) is duplicated. Import it from scanner instead. The generator's `scanDirectories` function stays in generator.ts since it has the `guessDirectoryPurpose` mapping specific to deterministic output.

At the top of `generator.ts`, add:
```typescript
import { readText } from "./scanner.js";
```

Remove the local `readText` function (lines 207-212).

- [ ] **Step 3: Export scanner from `src/index.ts`**

Add to `src/index.ts`:
```typescript
export { scanProjectRaw, scanFileTree, collectConfigs } from "./scanner.js";
export type { ScanResult, FileTreeEntry } from "./scanner.js";
```

- [ ] **Step 4: Build and verify no regressions**

Run: `cd /Users/vikassah/Documents/CodeCoinCognitionLLC/claudemd-lint && npm run build && npm test`
Expected: All 120+ tests pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/scanner.ts src/generator.ts src/index.ts
git commit -m "refactor: extract shared scanner for MCP tool and generator"
```

---

### Task 2: Simplify `init_claudemd` MCP tool to return raw data

**Files:**
- Modify: `src/mcp.ts` (rewrite `init_claudemd` tool handler)

- [ ] **Step 1: Update `init_claudemd` tool to use scanner**

Replace the current `init_claudemd` tool in `src/mcp.ts` (lines 172-218). The new version calls `scanProjectRaw` and returns the raw `ScanResult` as JSON.

In `src/mcp.ts`, update imports to add:
```typescript
import { scanProjectRaw, type ScanResult } from "./scanner.js";
```

Replace the `init_claudemd` tool registration with:
```typescript
server.tool(
  "init_claudemd",
  "Scan a project and return raw file tree + config contents for AI-powered CLAUDE.md generation. Returns structured data — use the claudemd-init prompt for full generation instructions.",
  {
    rootDir: z
      .string()
      .optional()
      .describe("Root directory of the project to scan. Defaults to current working directory."),
  },
  async ({ rootDir }) => {
    try {
      const dir = rootDir ? resolve(rootDir) : process.cwd();
      const result = scanProjectRaw(dir);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);
```

- [ ] **Step 2: Remove unused `generate` import from mcp.ts**

Remove from imports:
```typescript
import { generate } from "./generator.js";
```

- [ ] **Step 3: Build and verify**

Run: `cd /Users/vikassah/Documents/CodeCoinCognitionLLC/claudemd-lint && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/mcp.ts
git commit -m "refactor: simplify init_claudemd to return raw scan data"
```

---

### Task 3: Add `claudemd-init` MCP prompt with full rubric

**Files:**
- Modify: `src/mcp.ts` (add prompt registration)

This is the core deliverable — the MCP prompt that teaches Claude how to generate a high-quality CLAUDE.md.

- [ ] **Step 1: Add the `claudemd-init` prompt registration**

Add after the tool registrations in `src/mcp.ts`, before `const transport = ...`:

```typescript
server.prompt(
  "claudemd-init",
  "Generate an AI-powered CLAUDE.md by deeply reading the project codebase",
  {
    directory: z
      .string()
      .optional()
      .describe("Project root directory. Defaults to current working directory."),
  },
  async ({ directory }) => {
    const dir = directory ? resolve(directory) : process.cwd();
    const scanData = scanProjectRaw(dir);

    const prompt = buildGenerationPrompt(scanData);

    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: prompt,
          },
        },
      ],
    };
  }
);
```

- [ ] **Step 2: Write the `buildGenerationPrompt` function**

Add this function to `src/mcp.ts` above the `startMcpServer` export:

```typescript
function buildGenerationPrompt(scan: ScanResult): string {
  const configSummary = Object.entries(scan.configs)
    .map(([name, content]) => `### ${name}\n\`\`\`\n${content}\n\`\`\``)
    .join("\n\n");

  return `# Generate a CLAUDE.md for this project

You are generating a CLAUDE.md file — the operating context document that Claude Code reads before working in a codebase. Your goal is to produce a file that scores 8+ on all 7 linting dimensions.

## Project Data

**Project root:** \`${scan.projectRoot}\`
**Existing CLAUDE.md:** ${scan.existingClaudeMd ? "Yes — ask the user whether to overwrite, merge, or cancel before proceeding." : "No — generate fresh."}

### File Tree
\`\`\`
${scan.fileTree}
\`\`\`

### Config Files
${configSummary || "No config files found. Read the file tree and source files to infer the stack."}

## Your Task

### Phase 1: Read the Codebase
Using the file tree and configs above as orientation, read the actual source files to understand the project deeply. Prioritize in this order:
1. **README.md** — project identity, purpose, features
2. **Entry points** — \`server/index.ts\`, \`app.ts\`, \`main.py\`, \`src/index.ts\`, etc.
3. **Service/business logic** — files in \`services/\`, \`lib/\`, \`core/\` directories
4. **Route/controller files** — \`routes.ts\`, \`api/\`, \`controllers/\`
5. **Schema/model files** — Drizzle tables, Prisma models, Zod schemas, \`shared/\` types
6. **Config files** — build, deploy, CI configs you need more detail on

**Budget:** Read at most 20 source files. Prioritize files that reveal architecture and patterns over boilerplate.

### Phase 2: Understand and Extract
As you read, build a mental model of:
- **Project identity:** What is this? Who is it for? What makes it unique?
- **Tech stack with purpose:** Not just "Express" but "Express for REST API serving AI analysis results"
- **Architecture as narrative:** How components connect. Service patterns. Data flows. Describe the DESIGN, not a list of dependencies.
- **Every script and command:** What it does, when to use it
- **Env vars:** Which are truly required vs optional vs conditional (e.g., "only if AI_MODEL=openai"). Infer from actual code usage, not just .env.example
- **API surface:** Endpoints with method, path, what they accept, what they return
- **Database:** Engine, tables, is it optional? What's the fallback behavior?
- **Deployment:** Platform, constraints, port configuration, required setup
- **Real gotchas:** Things that will trip Claude up when working in this codebase. Be specific: "Port 5000 is hardcoded for Replit in routes.ts" not "consider rate limiting"

### Phase 3: Write the CLAUDE.md

Write the file optimized for these 7 scoring dimensions:

**1. Consistency** — No contradictions. If the project uses npm, don't reference yarn. If env vars are optional, don't mark them required.

**2. Staleness** — Only reference files, functions, and patterns that actually exist. Don't mention placeholder/unimplemented features without flagging them.

**3. Redundancy** — Say things once. Don't repeat the description in overview AND architecture. Don't list the same dep in multiple sections.

**4. Scope Specificity** — Every line must be specific to THIS project. "Wrap async in try/catch" is generic. "AI model responses must validate against analysisResultSchema — malformed JSON from Llava will throw" is specific.

**5. Token Efficiency** — Target under 200 lines. Use tables for structured data. No prose walls. Don't explain what Claude already knows.

**6. Actionability** — Every instruction must be mechanically followable. Include actual file paths, function names, and patterns. "Handle errors properly" is vague. "API routes return \`{ error: string }\` with HTTP 4xx/5xx" is actionable.

**7. Maintainability** — Clear heading hierarchy. Logical section order. Include \`Last updated:\` timestamp.

### Anti-Patterns — Do NOT:
- Dump a flat list of dependencies as "architecture" (the #1 failure mode)
- Mark all env vars as "Required"
- Include deps from package.json that aren't actually imported/used in the code
- Write generic rules ("write clean code", "follow best practices", "use meaningful names")
- Write for human developers — write for Claude as the primary reader
- Add empty TODO placeholders
- Include boilerplate error handling or naming convention sections unless the project has specific, non-obvious conventions
- Over-explain standard framework behavior
- Add comments like "// Added by generator" or "// Auto-generated"

### Output Format

Follow this structure (skip sections that don't apply):

\`\`\`markdown
# {Project Name}

{One-line description}

{Language}, {Framework}, {Key distinguishing lib} project.

## Build and Dev Commands
{Every useful script — table or bullet list with descriptions}

## Project Structure
{Directory tree with meaningful, specific descriptions}

## Architecture
{NARRATIVE — how components connect, key design patterns, data flows}
{This is the most important section. Describe the design, not the dependencies.}

## API Endpoints
{Table: method | path | input | output | purpose}

## Environment Variables
{Table: name | required/optional/conditional | default | what it unlocks}
{If .env.example exists: "Copy .env.example to .env and configure before running."}

## Database
{Engine, schema location, tables with columns, optional/required, fallback behavior}

## Common Gotchas
{Project-specific pitfalls — things that will cause bugs if Claude doesn't know them}

## Deployment
{Platform, port, build steps, pre-deploy checklist}

## Testing
{Framework, commands, patterns, setup}

## Coding Conventions
{ONLY if project-specific and non-obvious}

Last updated: {today's date}
\`\`\`

### Final Step
After writing the CLAUDE.md, use the \`lint_claudemd\` tool to score it. If any dimension scores below 7, revise and re-lint until all dimensions score 7+.

Now begin: read the source files and generate the CLAUDE.md.`;
}
```

- [ ] **Step 3: Build and verify**

Run: `cd /Users/vikassah/Documents/CodeCoinCognitionLLC/claudemd-lint && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Manual test — start MCP server and verify prompt is listed**

Run: `echo '{"jsonrpc":"2.0","id":1,"method":"prompts/list"}' | node dist/bin/cli.js --mcp 2>/dev/null | head -5`
Expected: Response includes `claudemd-init` prompt in the list.

- [ ] **Step 5: Commit**

```bash
git add src/mcp.ts
git commit -m "feat: add claudemd-init MCP prompt with 7-dimension rubric"
```

---

### Task 4: Update version, README, and exports

**Files:**
- Modify: `package.json` (bump version)
- Modify: `README.md` (document AI-first mode)
- Modify: `src/index.ts` (ensure exports are clean)

- [ ] **Step 1: Bump version to 0.3.0**

In `package.json`, change `"version": "0.2.0"` to `"version": "0.3.0"`.

- [ ] **Step 2: Update README install section**

In `README.md`, update the install section to mention the AI-first generation mode. After the existing "As a Claude Code plugin" section, add a note that the plugin now includes AI-powered generation via the `claudemd-init` prompt.

- [ ] **Step 3: Add AI-first generation to the feature table**

In the "What Can It Do?" table in README.md, update the Generate row to mention both modes:
- AI-first (inside Claude Code): deep codebase reading + 7-dimension rubric
- Deterministic (CLI): static scanning fallback

- [ ] **Step 4: Build final**

Run: `cd /Users/vikassah/Documents/CodeCoinCognitionLLC/claudemd-lint && npm run build && npm test`
Expected: All tests pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add package.json README.md src/index.ts
git commit -m "feat: v0.3.0 — AI-first CLAUDE.md generation via MCP prompt"
```

---

### Task 5: Integration test — run against fitcheckai

**Files:**
- No new files — manual validation

- [ ] **Step 1: Start the MCP server and test `init_claudemd` tool**

Run: `cd /Users/vikassah/Documents/code/fitcheck-ai && echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"init_claudemd","arguments":{}}}' | node /Users/vikassah/Documents/CodeCoinCognitionLLC/claudemd-lint/dist/bin/cli.js --mcp 2>/dev/null`

Expected: JSON response with `projectRoot`, `fileTree`, `configs`, `existingClaudeMd` fields.

- [ ] **Step 2: Verify the CLI deterministic mode still works**

Run: `cd /tmp && mkdir test-init && cd test-init && npm init -y && node /Users/vikassah/Documents/CodeCoinCognitionLLC/claudemd-lint/dist/bin/cli.js --init`

Expected: Generates a CLAUDE.md using the deterministic scanner (unchanged behavior).

- [ ] **Step 3: Clean up test directory**

Run: `rm -rf /tmp/test-init`

- [ ] **Step 4: Verify MCP prompt lists correctly**

Test that the MCP server advertises the `claudemd-init` prompt alongside the existing tools.

- [ ] **Step 5: Commit any test fixes if needed**

Only if issues were found and fixed in previous steps.

---

### Task 6: End-to-end validation inside Claude Code

**Files:**
- No code changes — user acceptance test

- [ ] **Step 1: Reinstall the MCP server**

```bash
claude mcp remove claudemd-lint
claude mcp add claudemd-lint -- npx @vikassah/claudemd-lint --mcp
```

Or for local dev:
```bash
claude mcp remove claudemd-lint
claude mcp add claudemd-lint -- node /Users/vikassah/Documents/CodeCoinCognitionLLC/claudemd-lint/dist/bin/cli.js --mcp
```

- [ ] **Step 2: Test AI-first generation on fitcheckai**

In a new Claude Code session at `/Users/vikassah/Documents/code/fitcheck-ai`, use the `claudemd-init` prompt (or ask Claude to generate a CLAUDE.md).

- [ ] **Step 3: Validate against success criteria**

Check the generated CLAUDE.md against the 8 success criteria from the spec:
1. Describes pluggable AI model system (not flat dep list)
2. `OPENAI_API_KEY` marked conditional (not required)
3. No Passport.js/WebSocket if unused
4. `server/services/` described as AI model integrations
5. Database described as optional with in-memory fallback
6. Port 5000 hardcoded for Replit noted
7. Scores 8+ on all 7 dimensions
8. Under 200 lines

- [ ] **Step 4: Run linter on generated output**

```bash
cd /Users/vikassah/Documents/code/fitcheck-ai && npx @vikassah/claudemd-lint
```

Expected: Score 8+/10 on all dimensions.

- [ ] **Step 5: Final commit if any adjustments needed**

Only if prompt tuning was required based on validation results.
