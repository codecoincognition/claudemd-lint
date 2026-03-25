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
import { scanProjectRaw, type ScanResult } from "./scanner.js";
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

/**
 * Build the full generation prompt for the claudemd-init MCP prompt.
 * Embeds scan data and a 7-dimension rubric that guides the AI to produce
 * a high-quality CLAUDE.md.
 */
function buildGenerationPrompt(scan: ScanResult): string {
  const configSummary = Object.entries(scan.configs)
    .map(([name, content]) => `### ${name}\n\`\`\`\n${content}\n\`\`\``)
    .join("\n\n");

  return `Generate a CLAUDE.md for this project. CLAUDE.md is the operating context document that Claude Code reads before working in a codebase. Your goal is to produce a file that scores 8+ on all 7 linting dimensions.

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
2. **Entry points** — server/index.ts, app.ts, main.py, src/index.ts, etc.
3. **Service/business logic** — files in services/, lib/, core/ directories
4. **Route/controller files** — routes.ts, api/, controllers/
5. **Schema/model files** — Drizzle tables, Prisma models, Zod schemas, shared/ types
6. **Config files** — build, deploy, CI configs you need more detail on

**Budget:** Read at most 20 source files. Prioritize files that reveal architecture and patterns over boilerplate.

### Phase 2: Understand and Extract
As you read, build a mental model of:
- **Project identity:** What is this? Who is it for? What makes it unique?
- **Tech stack with purpose:** Not just "Express" but "Express for REST API serving AI analysis results"
- **Architecture as narrative:** Trace the primary data flow end-to-end (e.g., "user uploads image → Express receives multipart → ai-service.ts selects model based on AI_MODEL env var → model returns JSON → validated against Zod schema → response sent"). Identify design patterns (factory, adapter, fallback chain, pub/sub). Name the orchestrator files. This becomes the Architecture section — it is the MOST IMPORTANT section of the CLAUDE.md.
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

**6. Actionability** — Every instruction must be mechanically followable. Include actual file paths, function names, and patterns. "Handle errors properly" is vague. "API routes return \\\`{ error: string }\\\` with HTTP 4xx/5xx" is actionable.

**7. Maintainability** — Clear heading hierarchy. Logical section order. Include Last updated: timestamp.

### Anti-Patterns — Do NOT:
- Dump a flat list of dependencies as "architecture" (the #1 failure mode)
- Mark all env vars as "Required"
- Include deps from package.json that aren't actually imported/used in the code
- Write generic rules ("write clean code", "follow best practices", "use meaningful names")
- Write for human developers — write for Claude as the primary reader
- Add empty TODO placeholders
- Include boilerplate error handling sections (e.g., "wrap async in try/catch") — Claude already knows this
- Include boilerplate naming convention sections (e.g., "PascalCase for components") — only include conventions that are surprising or project-specific
- Over-explain standard framework behavior
- Add comments like "// Added by generator" or "// Auto-generated"

### Output Format

Follow this structure (skip sections that don't apply):

\\\`\\\`\\\`markdown
# {Project Name}

{One-line description}

{Language}, {Framework}, {Key distinguishing lib} project.

## Build and Dev Commands
{Every useful script — table or bullet list with descriptions}

## Project Structure
{Directory tree with meaningful, specific descriptions}

## Architecture
{REQUIRED. This is the most important section.}
{Trace the primary data flow end-to-end. Name the orchestrator files.}
{Identify design patterns: factory, adapter, fallback chain, middleware pipeline, etc.}
{Example: "Upload flow: client/UploadSection.tsx → POST /api/analyze → ai-service.ts selects model via AI_MODEL → gemini.ts/llava.ts/openai.ts → response validated against analysisResultSchema → client displays results"}
{Do NOT just list technologies. Describe HOW they work together.}

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
{Include hardcoded values: ports, hostnames, platform-specific configs like .replit}

## Testing
{Framework, commands, patterns, setup}

## Coding Conventions
{ONLY if project-specific and non-obvious}

Last updated: {today's date}
\\\`\\\`\\\`

### Final Step
After writing the CLAUDE.md, use the lint_claudemd tool to score it. If any dimension scores below 7, revise and re-lint until all dimensions score 7+.

Now begin: read the source files and generate the CLAUDE.md.`;
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

  server.tool(
    "init_claudemd",
    "Generate a high-quality CLAUDE.md by scanning the project and returning structured data + generation instructions. Call this tool, then follow the instructions in the response to read source files and write the CLAUDE.md.",
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
        const prompt = buildGenerationPrompt(result);

        return {
          content: [
            {
              type: "text" as const,
              text: prompt,
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

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
