# MCP Server Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `--mcp` flag to claudemd-lint that launches an MCP stdio server, enabling Claude Code users to install with `claude mcp add claudemd-lint -- npx claudemd-lint --mcp`.

**Architecture:** Single new file `src/mcp.ts` implements the MCP server using `@modelcontextprotocol/sdk`. The CLI entry point (`bin/cli.ts`) gains `--mcp` detection that short-circuits to the MCP server. Two MCP tools are exposed: `lint_claudemd` and `discover_claudemd`, which delegate to the existing `lint()` and `discoverFiles()` functions.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk` ^1.12.0 (includes zod), Node.js >= 20

**Spec:** `docs/superpowers/specs/2026-03-22-mcp-server-mode-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/mcp.ts` | Create | MCP server: tool registration, truncation, error handling, stdio transport |
| `bin/cli.ts` | Modify | Add `--mcp` flag detection, import and call `startMcpServer()` |
| `package.json` | Modify | Add `@modelcontextprotocol/sdk` and `zod` dependencies |
| `src/index.ts` | Modify | Re-export `startMcpServer` for programmatic use |

---

### Task 1: Install MCP SDK dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the MCP SDK**

```bash
cd /Users/vikassah/Documents/CodeCoinCognitionLLC/claudemd-lint
npm install @modelcontextprotocol/sdk@^1.12.0 zod@^3.23.8
```

- [ ] **Step 2: Verify it installed correctly**

```bash
node -e "import('@modelcontextprotocol/sdk/server/mcp.js').then(() => console.log('OK'))"
```

Expected: `OK`

- [ ] **Step 3: Verify zod is available (bundled with SDK)**

```bash
node -e "import('zod').then(({z}) => console.log(z.string().parse('test')))"
```

Expected: `test`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add @modelcontextprotocol/sdk for MCP server mode"
```

---

### Task 2: Create MCP server module

**Files:**
- Create: `src/mcp.ts`

- [ ] **Step 1: Create `src/mcp.ts` with full implementation**

```typescript
/**
 * MCP server mode — exposes claudemd-lint as a Claude Code plugin
 *
 * Install:  claude mcp add claudemd-lint -- npx claudemd-lint --mcp
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { lint } from "./scorer.js";
import { discoverFiles } from "./parser.js";
import { DEFAULT_CONFIG } from "./types.js";
import type { LintConfig, Finding } from "./types.js";

/**
 * Truncate findings to keep MCP responses token-efficient.
 * Takes first N of each severity in document order.
 */
function truncateFindings(findings: Finding[]): {
  truncated: Finding[];
  totalFindings: number;
} {
  const errors = findings.filter((f) => f.severity === "error").slice(0, 5);
  const warnings = findings.filter((f) => f.severity === "warning").slice(0, 5);
  const infos = findings.filter((f) => f.severity === "info").slice(0, 3);
  return {
    truncated: [...errors, ...warnings, ...infos],
    totalFindings: findings.length,
  };
}

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: "claudemd-lint",
    version: "0.1.0",
  });

  server.tool(
    "lint_claudemd",
    "Lint a CLAUDE.md file and return a structured health report with scores across 7 dimensions",
    {
      path: z
        .string()
        .optional()
        .describe(
          "Path to a CLAUDE.md file. Defaults to auto-discovering CLAUDE.md in the current working directory."
        ),
    },
    async ({ path }) => {
      try {
        const cwd = process.cwd();

        // Resolve the file path
        let filePath: string;
        if (path) {
          filePath = resolve(path);
        } else {
          filePath = resolve(cwd, "CLAUDE.md");
          if (!existsSync(filePath)) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Error: No CLAUDE.md found in current directory. Specify a path.",
                },
              ],
              isError: true,
            };
          }
        }

        // Check file exists (when path was explicitly provided)
        if (path && !existsSync(filePath)) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: File not found: ${filePath}`,
              },
            ],
            isError: true,
          };
        }

        const config: LintConfig = {
          ...DEFAULT_CONFIG,
          rootDir: cwd,
        };

        const report = lint(filePath, config);
        const { truncated, totalFindings } = truncateFindings(report.findings);

        const result = {
          filePath: report.filePath,
          overallScore: report.overallScore,
          verdict: report.verdict,
          dimensions: report.dimensions.map((d) => ({
            dimension: d.dimension,
            score: d.score,
            summary: d.summary,
          })),
          findings: truncated,
          totalFindings,
          stats: report.stats,
        };

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

  server.tool(
    "discover_claudemd",
    "Find all CLAUDE.md files in a directory hierarchy (root + immediate subdirectories)",
    {
      rootDir: z
        .string()
        .optional()
        .describe(
          "Root directory to search. Defaults to current working directory."
        ),
    },
    async ({ rootDir }) => {
      try {
        const dir = rootDir ? resolve(rootDir) : process.cwd();
        const files = discoverFiles(dir);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(files, null, 2),
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

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

- [ ] **Step 2: Build and verify no type errors**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/mcp.ts
git commit -m "feat: add MCP server module with lint_claudemd and discover_claudemd tools"
```

---

### Task 3: Wire `--mcp` flag into CLI

**Files:**
- Modify: `bin/cli.ts:22-42` (parseArgs function)
- Modify: `bin/cli.ts:68-143` (main function)

- [ ] **Step 1: Add `mcp` to parseArgs return type and parsing**

In `bin/cli.ts`, update `parseArgs` to detect `--mcp`:

```typescript
function parseArgs(argv: string[]): {
  paths: string[];
  format: "terminal" | "json" | "ci";
  discover: boolean;
  help: boolean;
  mcp: boolean;
} {
  const paths: string[] = [];
  let format: "terminal" | "json" | "ci" = "terminal";
  let discover = false;
  let help = false;
  let mcp = false;

  for (const arg of argv.slice(2)) {
    if (arg === "--json") format = "json";
    else if (arg === "--ci") format = "ci";
    else if (arg === "--discover") discover = true;
    else if (arg === "--help" || arg === "-h") help = true;
    else if (arg === "--mcp") mcp = true;
    else if (!arg.startsWith("-")) paths.push(arg);
  }

  return { paths, format, discover, help, mcp };
}
```

- [ ] **Step 2: Add MCP early-exit to `main()`**

At the top of `main()`, right after `const args = parseArgs(process.argv);`, add the MCP branch before the help check:

```typescript
  if (args.mcp) {
    const { startMcpServer } = await import("../src/mcp.js");
    await startMcpServer();
    return;
  }
```

Since `main()` is currently not async, change `function main(): void` to `async function main(): Promise<void>`.

Also update the call site at the bottom of the file from:
```typescript
main();
```
to:
```typescript
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Add `--mcp` to the help text**

In `printHelp()`, add to the OPTIONS section:

```
  --mcp         Start as MCP server (for Claude Code integration)
```

And add to EXAMPLES:

```
  claude mcp add claudemd-lint -- npx claudemd-lint --mcp
```

- [ ] **Step 4: Build and verify**

```bash
npx tsc
```

Expected: No errors, `dist/` populated

- [ ] **Step 5: Verify CLI still works**

```bash
node dist/bin/cli.js fixtures/good.md
```

Expected: Terminal report with scores

- [ ] **Step 6: Verify `--mcp` starts the server (it will hang waiting for stdin — Ctrl+C to exit)**

```bash
node dist/bin/cli.js --mcp & PID=$!; sleep 2; kill $PID 2>/dev/null; echo "Server started and was killed"
```

Expected: "Server started and was killed" (server started and was waiting for input)

- [ ] **Step 7: Commit**

```bash
git add bin/cli.ts
git commit -m "feat: wire --mcp flag to launch MCP server from CLI"
```

---

### Task 4: Re-export from public API

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add `startMcpServer` export to `src/index.ts`**

Add this line to the existing exports:

```typescript
export { startMcpServer } from "./mcp.js";
```

- [ ] **Step 2: Build**

```bash
npx tsc
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: re-export startMcpServer from public API"
```

---

### Task 5: Update README with MCP install instructions

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add MCP section to README**

Add a new section after the existing "Quick Start" section:

```markdown
## Claude Code Integration (MCP)

Install as a Claude Code plugin with one command:

\`\`\`bash
claude mcp add claudemd-lint -- npx claudemd-lint --mcp
\`\`\`

This exposes two tools to Claude:

- **`lint_claudemd`** — Lint a CLAUDE.md file and return scores across 7 dimensions
- **`discover_claudemd`** — Find all CLAUDE.md files in a project hierarchy

Once installed, Claude can automatically lint your CLAUDE.md files during sessions.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add MCP/Claude Code integration instructions to README"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Full build**

```bash
cd /Users/vikassah/Documents/CodeCoinCognitionLLC/claudemd-lint
npx tsc
```

- [ ] **Step 2: Verify CLI mode still works**

```bash
node dist/bin/cli.js fixtures/good.md
node dist/bin/cli.js fixtures/bad.md
node dist/bin/cli.js --json fixtures/good.md
node dist/bin/cli.js --discover
node dist/bin/cli.js --help
```

All should produce expected output.

- [ ] **Step 3: Verify MCP server starts**

```bash
node dist/bin/cli.js --mcp & PID=$!; sleep 2; kill $PID 2>/dev/null; echo "Server started and was killed"
```

Expected: "Server started and was killed"

- [ ] **Step 4: Verify `--mcp` ignores other flags**

```bash
timeout 2 node dist/bin/cli.js --mcp --json fixtures/bad.md 2>/dev/null; echo "Exit code: $?"
```

Expected: "Server started and was killed" (MCP server started, --json and path ignored)

- [ ] **Step 5: Test MCP tool invocation via JSON-RPC**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/bin/cli.js --mcp 2>/dev/null | head -1
```

Expected: JSON response with server capabilities

- [ ] **Step 6: Local Claude Code integration test**

```bash
claude mcp add claudemd-lint -- node /Users/vikassah/Documents/CodeCoinCognitionLLC/claudemd-lint/dist/bin/cli.js --mcp
```

Then in a Claude Code session, verify the `lint_claudemd` tool is available.
