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
import { generate } from "./generator.js";
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

  server.tool(
    "init_claudemd",
    "Generate a CLAUDE.md file by scanning the project's configs, directory structure, CI, and dependencies. Returns the generated content without writing to disk.",
    {
      rootDir: z
        .string()
        .optional()
        .describe(
          "Root directory of the project to scan. Defaults to current working directory."
        ),
    },
    async ({ rootDir }) => {
      try {
        const dir = rootDir ? resolve(rootDir) : process.cwd();
        const result = generate(dir);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  generatedContent: result.content,
                  detections: result.detections,
                  summary: result.summary,
                  lineCount: result.content.split("\n").length,
                },
                null,
                2
              ),
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
