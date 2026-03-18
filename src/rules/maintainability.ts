/**
 * Maintainability rule — check structure, ownership, and organization
 */

import type { ParsedFile, DimensionScore, Finding } from "../types.js";

// Expected sections in a well-maintained CLAUDE.md
const RECOMMENDED_SECTIONS = [
  { pattern: /project\s*(structure|overview|layout)/i, name: "Project Structure" },
  { pattern: /build|compile|bundle/i, name: "Build Commands" },
  { pattern: /test(ing|s)?/i, name: "Testing" },
  { pattern: /lint(ing|er)?|format(ting|ter)?/i, name: "Linting/Formatting" },
  { pattern: /coding\s*(convention|standard|style|pattern)/i, name: "Coding Conventions" },
  { pattern: /error\s*(handling|pattern)/i, name: "Error Handling" },
  { pattern: /naming\s*(convention|pattern)/i, name: "File/Variable Naming" },
  { pattern: /deploy(ment)?/i, name: "Deployment" },
];

export function checkMaintainability(file: ParsedFile): DimensionScore {
  const findings: Finding[] = [];

  // Check for recommended sections
  const presentSections: string[] = [];
  const missingSections: string[] = [];

  for (const rec of RECOMMENDED_SECTIONS) {
    const found = file.sections.some((s) => rec.pattern.test(s.title));
    if (found) {
      presentSections.push(rec.name);
    } else {
      missingSections.push(rec.name);
    }
  }

  if (missingSections.length > 0) {
    findings.push({
      dimension: "maintainability",
      severity: missingSections.length > 4 ? "warning" : "info",
      message: `Missing recommended sections: ${missingSections.join(", ")}`,
      suggestion: `Consider adding sections for: ${missingSections.join(", ")}. High-performing CLAUDE.md files typically include these.`,
    });
  }

  // Check for section headings (basic structure)
  if (file.sections.length === 0) {
    findings.push({
      dimension: "maintainability",
      severity: "error",
      message: "No section headings found",
      suggestion:
        "Add Markdown headings (## Section Name) to organize content. Claude processes structured content more reliably than flat text.",
    });
  } else if (file.sections.length === 1) {
    findings.push({
      dimension: "maintainability",
      severity: "warning",
      message: "Only 1 section heading — file lacks organization",
      suggestion:
        "Break content into logical sections with clear headings. Aim for 4-8 sections.",
    });
  }

  // Check for timestamps / last-updated markers
  const hasTimestamp =
    /(?:last\s+)?(?:updated|modified|reviewed|edited)\s*:?\s*\d{4}/i.test(
      file.content
    ) || /\d{4}-\d{2}-\d{2}/.test(file.content);

  if (!hasTimestamp) {
    findings.push({
      dimension: "maintainability",
      severity: "info",
      message: "No timestamp or last-updated date found",
      suggestion:
        "Add a 'Last updated: YYYY-MM-DD' marker so reviewers know when the file was last maintained.",
    });
  }

  // Check for very long file without table of contents
  if (file.lineCount > 200 && file.sections.length > 5) {
    const hasToc =
      file.content.includes("Table of Contents") ||
      file.content.includes("## Contents") ||
      file.content.includes("## TOC");

    if (!hasToc) {
      findings.push({
        dimension: "maintainability",
        severity: "info",
        message: `Long file (${file.lineCount} lines, ${file.sections.length} sections) with no table of contents`,
        suggestion:
          "Add a table of contents for navigability. This helps both Claude and human reviewers.",
      });
    }
  }

  // Check heading hierarchy (no jumps from # to ###)
  let prevLevel = 0;
  for (const section of file.sections) {
    if (prevLevel > 0 && section.level > prevLevel + 1) {
      findings.push({
        dimension: "maintainability",
        severity: "info",
        message: `Heading level jumps from H${prevLevel} to H${section.level} at "${section.title}"`,
        line: section.startLine + 1,
        suggestion: `Use sequential heading levels (H${prevLevel} → H${prevLevel + 1}) for consistent structure.`,
      });
    }
    prevLevel = section.level;
  }

  // Score
  let score = 10;
  const completeness = presentSections.length / RECOMMENDED_SECTIONS.length;
  score -= Math.round((1 - completeness) * 3); // Up to -3 for missing sections

  score -= findings.filter((f) => f.severity === "error").length * 3;
  score -= findings.filter((f) => f.severity === "warning").length * 1.5;
  score -= findings.filter((f) => f.severity === "info").length * 0.5;

  return {
    dimension: "maintainability",
    score: Math.max(1, Math.min(10, Math.round(score))),
    findings,
    summary: `${presentSections.length}/${RECOMMENDED_SECTIONS.length} recommended sections present`,
  };
}
