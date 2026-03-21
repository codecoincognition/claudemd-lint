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
 *   npx claudemd-lint --fix           Auto-fix common issues and write back
 *   npx claudemd-lint --fix --dry-run Show what would be fixed without writing
 */

import { resolve, dirname } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { lint } from "../src/scorer.js";
import { discoverFiles } from "../src/parser.js";
import { formatTerminal, formatJson, formatCi } from "../src/reporter.js";
import { fix } from "../src/fixer.js";
import { DEFAULT_CONFIG } from "../src/types.js";
import type { LintConfig } from "../src/types.js";

const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";

function parseArgs(argv: string[]): {
  paths: string[];
  format: "terminal" | "json" | "ci";
  discover: boolean;
  help: boolean;
  fixMode: boolean;
  dryRun: boolean;
} {
  const paths: string[] = [];
  let format: "terminal" | "json" | "ci" = "terminal";
  let discover = false;
  let help = false;
  let fixMode = false;
  let dryRun = false;

  for (const arg of argv.slice(2)) {
    if (arg === "--json") format = "json";
    else if (arg === "--ci") format = "ci";
    else if (arg === "--discover") discover = true;
    else if (arg === "--help" || arg === "-h") help = true;
    else if (arg === "--fix") fixMode = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (!arg.startsWith("-")) paths.push(arg);
  }

  return { paths, format, discover, help, fixMode, dryRun };
}

function printHelp(): void {
  console.log(`
${BOLD}claudemd-lint${RESET} — Lint, validate, and score your CLAUDE.md

${BOLD}USAGE${RESET}
  claudemd-lint [options] [path...]

${BOLD}OPTIONS${RESET}
  --json        Output as JSON
  --ci          Output GitHub Actions annotations
  --discover    Find and lint all CLAUDE.md files in monorepo
  --fix         Auto-fix common issues and write the file back
  --dry-run     Show what --fix would change without writing (use with --fix)
  -h, --help    Show this help

${BOLD}EXAMPLES${RESET}
  claudemd-lint                          Lint ./CLAUDE.md
  claudemd-lint path/to/CLAUDE.md        Lint a specific file
  claudemd-lint --discover               Find and lint all CLAUDE.md files
  claudemd-lint --json > report.json     Export as JSON
  claudemd-lint --ci                     GitHub Actions mode
  claudemd-lint --fix                    Auto-fix and re-lint
  claudemd-lint --fix --dry-run          Preview fixes without writing

${DIM}7 Dimensions: Consistency · Staleness · Redundancy · Scope · Tokens · Actionability · Maintainability${RESET}
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

  // Lint (and optionally fix) each file
  let hasErrors = false;

  for (const filePath of filePaths) {
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      hasErrors = true;
      continue;
    }

    const config: LintConfig = {
      ...DEFAULT_CONFIG,
      rootDir: dirname(filePath),
      format: args.format,
    };

    try {
      // ── Fix mode ──────────────────────────────────────────────
      if (args.fixMode) {
        // 1. Initial lint
        const beforeReport = lint(filePath, config);
        const originalContent = readFileSync(filePath, "utf-8");

        // 2. Apply fixes
        const result = fix(originalContent, beforeReport.findings);

        if (result.actions.length === 0) {
          console.log(`${GREEN}No auto-fixable issues found.${RESET}`);
          console.log(formatTerminal(beforeReport));
          continue;
        }

        // 3. Show fix summary
        console.log("");
        console.log(`${BOLD}${args.dryRun ? "DRY RUN — " : ""}Fix Summary for ${filePath}${RESET}`);
        console.log("─".repeat(56));
        console.log("");

        for (const action of result.actions) {
          const loc = action.line ? `${DIM}(line ${action.line})${RESET} ` : "";
          const icon =
            action.type === "remove-boilerplate" || action.type === "remove-duplicate"
              ? `${YELLOW}[-]${RESET}`
              : action.type === "trim-filler" || action.type === "trim-whitespace"
                ? `${CYAN}[~]${RESET}`
                : `${GREEN}[+]${RESET}`;
          console.log(`  ${icon} ${loc}${action.description}`);
        }

        console.log("");
        console.log(`  ${BOLD}${result.summary}${RESET}`);
        console.log("");

        if (args.dryRun) {
          console.log(`${DIM}No files were modified (--dry-run).${RESET}`);
          console.log("");

          // Show the before score
          console.log(`${BOLD}Current score:${RESET} ${beforeReport.overallScore}/10 (${beforeReport.verdict})`);
          console.log("");
        } else {
          // 4. Write fixed content
          writeFileSync(filePath, result.content, "utf-8");
          console.log(`${GREEN}Wrote fixed file: ${filePath}${RESET}`);
          console.log("");

          // 5. Re-lint and show new score
          const afterReport = lint(filePath, config);
          const delta = afterReport.overallScore - beforeReport.overallScore;
          const deltaStr =
            delta > 0
              ? `${GREEN}+${delta.toFixed(1)}${RESET}`
              : delta < 0
                ? `${YELLOW}${delta.toFixed(1)}${RESET}`
                : "0";

          console.log(
            `${BOLD}Score: ${beforeReport.overallScore}/10 → ${afterReport.overallScore}/10 (${deltaStr})${RESET}`
          );
          console.log("");
          console.log(formatTerminal(afterReport));

          if (afterReport.verdict === "poor") {
            hasErrors = true;
          }
        }
        continue;
      }

      // ── Normal lint mode ──────────────────────────────────────
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
