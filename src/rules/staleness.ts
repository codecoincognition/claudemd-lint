/**
 * Staleness rule — detect stale file references and outdated patterns
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ParsedFile, DimensionScore, Finding } from "../types.js";

// Patterns that suggest version-specific references
const VERSION_PATTERNS = [
  /\breact\s+(\d+)/i,
  /\bnode\s+(\d+)/i,
  /\btypescript\s+(\d+)/i,
  /\bnext\.?js\s+(\d+)/i,
  /\bvue\s+(\d+)/i,
  /\bangular\s+(\d+)/i,
  /\bpython\s+(\d+)/i,
  /\bv(\d+\.\d+)/i,
];

// Deprecated tool/pattern references
const DEPRECATED_PATTERNS: Array<[RegExp, string]> = [
  [/\bcreate-react-app\b/i, "create-react-app is deprecated; consider Vite or Next.js"],
  [/\btslint\b/i, "TSLint is deprecated; use ESLint with typescript-eslint"],
  [/\bmoment\.?js\b/i, "Moment.js is in maintenance mode; consider date-fns or Temporal"],
  [/\brequest\s+library\b/i, "request is deprecated; use fetch or undici"],
  [/\bprotractor\b/i, "Protractor is deprecated; use Playwright or Cypress"],
  [/\benzyme\b/i, "Enzyme is largely deprecated for React 18+; use React Testing Library"],
];

export function checkStaleness(file: ParsedFile, rootDir: string): DimensionScore {
  const findings: Finding[] = [];

  // Check file references that don't exist
  for (const ref of file.fileRefs) {
    if (!ref.exists) {
      findings.push({
        dimension: "staleness",
        severity: "error",
        message: `Reference to non-existent file: ${ref.path}`,
        line: ref.line,
        suggestion: `Remove or update the reference to "${ref.path}" — file not found in codebase`,
      });
    }
  }

  // Check unresolved @imports
  for (const imp of file.imports) {
    if (!imp.resolved) {
      findings.push({
        dimension: "staleness",
        severity: "error",
        message: `Unresolved import: @${imp.path}`,
        line: imp.line,
        suggestion: `The imported file "${imp.path}" does not exist. Remove or fix the path.`,
      });
    }
  }

  // Check for deprecated tool references
  for (let i = 0; i < file.lines.length; i++) {
    const line = file.lines[i];
    for (const [pattern, msg] of DEPRECATED_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({
          dimension: "staleness",
          severity: "warning",
          message: msg,
          line: i + 1,
          suggestion: `Line ${i + 1} references a deprecated tool. ${msg}`,
        });
      }
    }
  }

  // Check if package.json exists and cross-reference mentioned packages
  const pkgPath = resolve(rootDir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(
        readFileSync(pkgPath, "utf-8")
      );
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      // Look for tool references in CLAUDE.md that aren't in package.json
      const toolPatterns: Array<[RegExp, string]> = [
        [/\bvitest\b/i, "vitest"],
        [/\bjest\b(?![-/])/i, "jest"],  // Avoid matching "jest-dom" or "@testing-library/jest-dom"
        [/\bmocha\b/i, "mocha"],
        [/\bcypress\b/i, "cypress"],
        [/\bplaywright\b/i, "playwright"],
        [/\bwebpack\b/i, "webpack"],
        [/\bvite\b/i, "vite"],
        [/\btailwind/i, "tailwindcss"],
        [/\bprisma\b/i, "prisma"],
        [/\bdrizzle\b/i, "drizzle-orm"],
        [/\bexpress\b/i, "express"],
        [/\bfastify\b/i, "fastify"],
        [/\bnext\.?js\b/i, "next"],
        [/\bsveltekit\b/i, "@sveltejs/kit"],
      ];

      for (const [pattern, pkgName] of toolPatterns) {
        for (let i = 0; i < file.lines.length; i++) {
          if (pattern.test(file.lines[i]) && !allDeps[pkgName]) {
            findings.push({
              dimension: "staleness",
              severity: "warning",
              message: `References "${pkgName}" but not found in package.json`,
              line: i + 1,
              suggestion: `Line ${i + 1} mentions "${pkgName}" which is not a project dependency. Remove if no longer used.`,
            });
            break; // One finding per package
          }
        }
      }
    } catch {
      // Failed to parse package.json — skip
    }
  }

  const errorCount = findings.filter((f) => f.severity === "error").length;
  const warnCount = findings.filter((f) => f.severity === "warning").length;
  const score = Math.max(1, 10 - errorCount * 2 - warnCount);

  return {
    dimension: "staleness",
    score,
    findings,
    summary:
      findings.length === 0
        ? "No stale references detected"
        : `${findings.length} stale reference(s) found`,
  };
}
