/**
 * Scanner module — shared project scanning logic used by the generator and MCP tools.
 *
 * Provides file-tree building, config collection, and a combined scanProjectRaw
 * that produces a structured ScanResult for downstream consumers.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";

// ── Types ────────────────────────────────────────────────────────────

export interface ScanResult {
  projectRoot: string;
  fileTree: string;
  configs: Record<string, string>;
  existingClaudeMd: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  ".next",
  ".nuxt",
  ".svelte-kit",
  "__pycache__",
  ".venv",
  "venv",
  "env",
  ".env",
  "target",
  "coverage",
  ".cache",
  ".turbo",
  ".vercel",
  ".output",
  "attached_assets",
]);

/**
 * Read a file and return its contents as a string, or null on any error.
 */
export function readText(filePath: string): string | null {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

// ── File tree ────────────────────────────────────────────────────────

/**
 * Build a human-readable file tree string.
 *
 * - 2 levels deep for files, 3 levels for directories
 * - Directories sorted first, then files, both alphabetically
 * - Capped at maxEntries total lines
 */
export function scanFileTree(rootDir: string, maxEntries = 200): string {
  const lines: string[] = [];
  let count = 0;

  function walk(dir: string, prefix: string, depth: number): void {
    if (count >= maxEntries) return;

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    // Classify and filter
    const dirs: string[] = [];
    const files: string[] = [];
    for (const name of entries) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(dir, name);
      try {
        const st = statSync(full);
        if (st.isDirectory()) {
          dirs.push(name);
        } else {
          files.push(name);
        }
      } catch {
        // skip unreadable entries
      }
    }

    dirs.sort((a, b) => a.localeCompare(b));
    files.sort((a, b) => a.localeCompare(b));

    const combined = [...dirs.map((d) => ({ name: d, isDir: true })), ...files.map((f) => ({ name: f, isDir: false }))];

    for (let i = 0; i < combined.length; i++) {
      if (count >= maxEntries) {
        lines.push(`${prefix}... (truncated)`);
        count++;
        return;
      }

      const entry = combined[i];
      const isLast = i === combined.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const childPrefix = isLast ? "    " : "│   ";

      if (entry.isDir) {
        lines.push(`${prefix}${connector}${entry.name}/`);
        count++;
        // Recurse into dirs up to 3 levels deep
        if (depth < 3) {
          walk(join(dir, entry.name), prefix + childPrefix, depth + 1);
        }
      } else {
        // Files shown up to 2 levels deep
        if (depth <= 2) {
          lines.push(`${prefix}${connector}${entry.name}`);
          count++;
        }
      }
    }
  }

  walk(rootDir, "", 1);
  return lines.join("\n");
}

// ── Config collection ────────────────────────────────────────────────

/** Well-known config files to look for at the project root. */
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
  ".gitlab-ci.yml",
];

/**
 * Collect raw contents of known config files that exist in the project.
 *
 * Also scans `.github/workflows/*.yml` for CI configs.
 */
export function collectConfigs(rootDir: string): Record<string, string> {
  const configs: Record<string, string> = {};

  for (const rel of CONFIG_FILES) {
    const full = resolve(rootDir, rel);
    const content = readText(full);
    if (content !== null) {
      configs[rel] = content;
    }
  }

  // Scan GitHub Actions workflows
  const workflowDir = resolve(rootDir, ".github/workflows");
  if (existsSync(workflowDir)) {
    try {
      for (const name of readdirSync(workflowDir)) {
        if (name.endsWith(".yml") || name.endsWith(".yaml")) {
          const rel = `.github/workflows/${name}`;
          const content = readText(resolve(rootDir, rel));
          if (content !== null) {
            configs[rel] = content;
          }
        }
      }
    } catch {
      // ignore unreadable workflow dir
    }
  }

  return configs;
}

// ── Combined scan ────────────────────────────────────────────────────

/**
 * Perform a full project scan: file tree, config contents, and CLAUDE.md presence.
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
