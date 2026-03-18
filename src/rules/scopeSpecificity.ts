/**
 * Scope Specificity rule — check monorepo hierarchy and relevance
 */

import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { resolve, dirname, basename, relative } from "node:path";
import type { ParsedFile, DimensionScore, Finding } from "../types.js";

export function checkScopeSpecificity(
  file: ParsedFile,
  rootDir: string
): DimensionScore {
  const findings: Finding[] = [];
  const fileDir = dirname(file.path);
  const isRoot = fileDir === resolve(rootDir);

  // Detect if this is a monorepo
  const subdirs = getSubdirectories(rootDir);
  const isMonorepo = subdirs.length >= 3; // Heuristic: 3+ subdirs with code

  if (isMonorepo && isRoot) {
    // Root CLAUDE.md in a monorepo — check for service-specific content
    const servicePatterns = subdirs.map((d) => ({
      name: basename(d),
      pattern: new RegExp(`\\b${escapeRegex(basename(d))}\\b`, "i"),
    }));

    let serviceSpecificLines = 0;
    for (let i = 0; i < file.lines.length; i++) {
      const line = file.lines[i];
      for (const svc of servicePatterns) {
        if (svc.pattern.test(line)) {
          serviceSpecificLines++;
        }
      }
    }

    const ratio = serviceSpecificLines / file.lineCount;
    if (ratio > 0.3) {
      findings.push({
        dimension: "scopeSpecificity",
        severity: "warning",
        message: `Root CLAUDE.md contains ~${Math.round(ratio * 100)}% service-specific content`,
        suggestion: `Consider splitting service-specific rules into subdirectory CLAUDE.md files (e.g., frontend/CLAUDE.md, backend/CLAUDE.md). Root file should contain only shared patterns.`,
      });
    }

    // Check if subdirectories have their own CLAUDE.md
    const missingFiles = subdirs.filter(
      (d) => !existsSync(resolve(d, "CLAUDE.md"))
    );
    if (missingFiles.length > 0 && missingFiles.length < subdirs.length) {
      // Some have it, some don't — inconsistent
      findings.push({
        dimension: "scopeSpecificity",
        severity: "info",
        message: `${missingFiles.length}/${subdirs.length} subdirectories lack a CLAUDE.md`,
        suggestion: `Subdirectories without CLAUDE.md: ${missingFiles.map((d) => relative(rootDir, d)).join(", ")}. Consider adding service-specific CLAUDE.md files for consistency.`,
      });
    }
  }

  if (!isRoot && isMonorepo) {
    // Child CLAUDE.md — check for duplicated root content
    const rootFile = resolve(rootDir, "CLAUDE.md");
    if (existsSync(rootFile)) {
      try {
        const rootContent = readFileSync(rootFile, "utf-8")
          .split("\n");

        let duplicatedLines = 0;
        for (const line of file.lines) {
          const trimmed = line.trim();
          if (trimmed.length < 15) continue;
          if (rootContent.some((rl: string) => rl.trim() === trimmed)) {
            duplicatedLines++;
          }
        }

        const dupRatio = duplicatedLines / file.lineCount;
        if (dupRatio > 0.2) {
          findings.push({
            dimension: "scopeSpecificity",
            severity: "warning",
            message: `~${Math.round(dupRatio * 100)}% of content duplicates the root CLAUDE.md`,
            suggestion: `Remove rules already present in the root CLAUDE.md. Child files should only contain directory-specific rules. Claude reads both files when working in this directory.`,
          });
        }
      } catch {
        // Can't read root — skip
      }
    }
  }

  // Check if file contains rules about technologies not in this directory
  // (simplified: just check for common framework mentions)
  const techMentions = countTechMentions(file);
  if (techMentions.total > 0 && techMentions.irrelevant > techMentions.total * 0.4) {
    findings.push({
      dimension: "scopeSpecificity",
      severity: "info",
      message: `File mentions technologies that may not be relevant to this directory`,
      suggestion: `Review whether all technology references are relevant. ~${Math.round((techMentions.irrelevant / techMentions.total) * 100)}% of tech references may belong in a different CLAUDE.md file.`,
    });
  }

  const score = Math.max(
    1,
    10 -
      findings.filter((f) => f.severity === "warning").length * 2 -
      findings.filter((f) => f.severity === "info").length
  );

  return {
    dimension: "scopeSpecificity",
    score,
    findings,
    summary:
      findings.length === 0
        ? "Scope is well-defined"
        : `${findings.length} scope issue(s) found`,
  };
}

function getSubdirectories(rootDir: string): string[] {
  try {
    return readdirSync(rootDir, { withFileTypes: true })
      .filter(
        (d) =>
          d.isDirectory() &&
          !d.name.startsWith(".") &&
          !["node_modules", "dist", "build", "coverage", "__pycache__"].includes(
            d.name
          )
      )
      .map((d) => resolve(rootDir, d.name));
  } catch {
    return [];
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface TechMentions {
  total: number;
  irrelevant: number;
}

function countTechMentions(file: ParsedFile): TechMentions {
  // Simplified — would be enhanced with actual codebase scanning
  return { total: 0, irrelevant: 0 };
}
