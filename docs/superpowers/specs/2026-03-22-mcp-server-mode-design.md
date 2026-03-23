# MCP Server Mode for claudemd-lint

## Problem

Claude Code users want to lint their CLAUDE.md files natively during sessions. Currently claudemd-lint is a standalone CLI — it has no integration with Claude Code's plugin system (MCP).

## Solution

Add a `--mcp` flag to the existing CLI that launches claudemd-lint as a stdio MCP server. Users install with one command:

```bash
claude mcp add claudemd-lint -- npx claudemd-lint --mcp
```

## MCP Tools

### `lint_claudemd`

Lint a CLAUDE.md file and return a structured report.

- **Input:**
  - `path` (string, optional) — path to a CLAUDE.md file. Defaults to auto-discovering `CLAUDE.md` in the current working directory.
- **Output:** JSON object with:
  - `overallScore` (number, 1-10)
  - `verdict` (string: "excellent" | "good" | "needs-work" | "poor")
  - `dimensions` (array of `{ dimension, score, summary }` — per-dimension `findings` arrays are omitted; findings are consolidated in the top-level field)
  - `findings` (array, first 5 errors + first 5 warnings + first 3 suggestions in document order)
  - `totalFindings` (number — total count before truncation, so consumer knows if data was omitted)
  - `stats` (object: lineCount, wordCount, estimatedTokens, etc.)

**Config construction:** Uses `DEFAULT_CONFIG` with `rootDir` set to `process.cwd()`, mirroring CLI behavior.

Truncation keeps MCP responses token-efficient. The full report is available via the CLI.

### `discover_claudemd`

Find all CLAUDE.md files in a directory tree.

- **Input:**
  - `rootDir` (string, optional) — root directory to search. Defaults to cwd.
- **Output:** JSON array of absolute file paths.

Note: `discoverFiles()` checks the root directory and immediate subdirectories only (not fully recursive). This matches existing CLI behavior.

## Error Handling

- **File not found:** `lint_claudemd` returns an MCP error response (`isError: true`) with message "File not found: <path>".
- **Parse/lint failure:** Returns an MCP error response with the exception message.
- **No files found:** `discover_claudemd` returns an empty array (not an error).

## Implementation

### New file: `src/mcp.ts`

- Creates a `McpServer` instance with name `"claudemd-lint"` and version `"0.1.0"`
- Registers `lint_claudemd` and `discover_claudemd` tools with zod input schemas
- `lint_claudemd` calls existing `lint()` from `src/scorer.ts` with `DEFAULT_CONFIG` (`rootDir: process.cwd()`), truncates findings, returns as text content
- `discover_claudemd` calls existing `discoverFiles()` from `src/parser.ts`
- Exports a `startMcpServer()` function that connects via `StdioServerTransport`

### Modified file: `bin/cli.ts`

- Detect `--mcp` in argv
- `--mcp` is mutually exclusive with all other flags. When present, all other arguments are ignored.
- If present, import and call `startMcpServer()` instead of running CLI logic
- All other flags (`--json`, `--ci`, `--discover`, `-h`) unchanged

### Modified file: `package.json`

- Add `@modelcontextprotocol/sdk` `"^1.12.0"` as a regular dependency
- Add `zod` as a regular dependency (required by MCP SDK for tool schemas)

## What Does NOT Change

- All existing lint logic (parser, scorer, rules, reporter)
- CLI behavior for all existing flags
- Types and public API exports
- Fixtures and test expectations

## Testing

- Build and run `node dist/bin/cli.js --mcp` to verify the server starts and accepts stdio
- Use `claude mcp add` locally to test end-to-end tool invocation
- Verify existing CLI still works: `node dist/bin/cli.js fixtures/good.md`
- Verify `--mcp --json` does not crash (--json is ignored, MCP server starts)

## Risks

- `@modelcontextprotocol/sdk` and `zod` become runtime dependencies (currently the project has zero runtime deps). Acceptable trade-off for the primary distribution channel.
- MCP SDK API may evolve. Pinned to `^1.12.0`.
