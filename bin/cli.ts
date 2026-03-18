#!/usr/bin/env node

/**
 * claudemd-lint CLI
 *
 * Usage:
 *   npx claudemd-lint [path]          Lint a CLAUDE.md file
 *   npx claudemd-lint                 Auto-discover CLAUDE.md in cwd
 *   npx claudemd-lint --json          Output as JSON
 *   npx claudemd-lint --ci            Output GitHub Actions annotations
 *   npx claudemd-lint --discover      Find all CLAUDE.md files in monorepo
 */

import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { lint } from "../src/scorer.js";
import { discoverFiles } from "../src/parser.js";
import { formatTerminal, formatJson, formatCi } from "../src/reporter.js";
import { DEFAULT_CONFIG } from "../src/types.js";
import type { LintConfig } from "../src/types.js";

function parseArgs(argv: string[]): {
  paths: string[];
  format: "terminal" | "json" | "ci";
  discover: boolean;
  help: boolean;
} {
  const paths: string[] = [];
  let format: "terminal" | "json" | "ci" = "terminal";
  let discover = false;
  let help = false;

  for (const arg of argv.slice(2)) {
    if (arg === "--json") format = "json";
    else if (arg === "--ci") format = "ci";
    else if (arg === "--discover") discover = true;
    else if (arg === "--help" || arg === "-h") help = true;
    else if (!arg.startsWith("-")) paths.push(arg);
  }

  return { paths, format, discover, help };
}

function printHelp(): void {
  console.log(`
\x1b[1mclaudemd-lint\x1b[0m — Lint, validate, and score your CLAUDE.md

\x1b[1mUSAGE\x1b[0m
  claudemd-lint [options] [path...]

\x1b[1mOPTIONS\x1b[0m
  --json        Output as JSON
  --ci          Output GitHub Actions annotations
  --discover    Find and lint all CLAUDE.md files in monorepo
  -h, --help    Show this help

\x1b[1mEXAMPLES\x1b[0m
  claudemd-lint                      Lint ./CLAUDE.md
  claudemd-lint path/to/CLAUDE.md    Lint a specific file
  claudemd-lint --discover           Find and lint all CLAUDE.md files
  claudemd-lint --json > report.json Export as JSON
  claudemd-lint --ci                 GitHub Actions mode

\x1b[2m7 Dimensions: Consistency · Staleness · Redundancy · Scope · Tokens · Actionability · Maintainability\x1b[0m
`);
}

function main(): void {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const cwd = process.cwd();

  // Resolve files to lint
  let filePaths: string[] = [];

  if (args.discover) {
    filePaths = discoverFiles(cwd);
    if (filePaths.length === 0) {
      console.error("No CLAUDE.md files found in current directory tree.");
      process.exit(1);
    }
  } else if (args.paths.length > 0) {
    filePaths = args.paths.map((p) => resolve(p));
  } else {
    // Default: look for CLAUDE.md in cwd
    const defaultPath = resolve(cwd, "CLAUDE.md");
    if (!existsSync(defaultPath)) {
      console.error(
        "No CLAUDE.md found in current directory. Specify a path or use --discover."
      );
      process.exit(1);
    }
    filePaths = [defaultPath];
  }

  // Lint each file
  let hasErrors = false;

  for (const filePath of filePaths) {
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      hasErrors = true;
      continue;
    }

    const config: LintConfig = {
      ...DEFAULT_CONFIG,
      rootDir: cwd,
      format: args.format,
    };

    try {
      const report = lint(filePath, config);

      switch (args.format) {
        case "json":
          console.log(formatJson(report));
          break;
        case "ci":
          console.log(formatCi(report));
          break;
        default:
          console.log(formatTerminal(report));
      }

      if (report.verdict === "poor") {
        hasErrors = true;
      }
    } catch (err: any) {
      console.error(`Error linting ${filePath}: ${err.message}`);
      hasErrors = true;
    }
  }

  process.exit(hasErrors ? 1 : 0);
}

main();
