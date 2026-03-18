/**
 * Reporter — terminal output, JSON mode, and CI mode
 */

import type { LintReport, DimensionScore, Finding, Dimension } from "./types.js";

const DIMENSION_LABELS: Record<Dimension, string> = {
  consistency: "CONSISTENCY",
  staleness: "STALENESS",
  redundancy: "REDUNDANCY",
  scopeSpecificity: "SCOPE",
  tokenEfficiency: "TOKENS",
  actionability: "ACTIONABILITY",
  maintainability: "MAINTAIN",
};

const SEVERITY_ICONS: Record<string, string> = {
  error: "\u274c",
  warning: "\u26a0\ufe0f",
  info: "\ud83d\udca1",
};

function scoreBar(score: number): string {
  const filled = Math.round(score);
  const empty = 10 - filled;
  return "\u2588".repeat(filled) + "\u2591".repeat(empty);
}

function verdictColor(verdict: string): string {
  switch (verdict) {
    case "excellent":
      return "\x1b[32m"; // green
    case "good":
      return "\x1b[33m"; // yellow
    case "needs-work":
      return "\x1b[33m"; // yellow
    case "poor":
      return "\x1b[31m"; // red
    default:
      return "\x1b[0m";
  }
}

function verdictLabel(verdict: string): string {
  switch (verdict) {
    case "excellent":
      return "Excellent";
    case "good":
      return "Good";
    case "needs-work":
      return "Needs Work";
    case "poor":
      return "Poor";
    default:
      return verdict;
  }
}

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";

export function formatTerminal(report: LintReport): string {
  const lines: string[] = [];
  const vc = verdictColor(report.verdict);

  lines.push("");
  lines.push(
    `${BOLD}\ud83d\udcca CLAUDE.md Health Report${RESET}`
  );
  lines.push("\u2550".repeat(56));
  lines.push("");
  lines.push(
    `  ${BOLD}Score: ${vc}${report.overallScore}/10 (${verdictLabel(report.verdict)})${RESET}`
  );
  lines.push(
    `  ${DIM}${report.stats.wordCount.toLocaleString()} words \u00b7 ${report.stats.lineCount} lines \u00b7 ~${report.stats.estimatedTokens.toLocaleString()} tokens${RESET}`
  );
  lines.push("");

  // Dimension scores
  for (const dim of report.dimensions) {
    const label = DIMENSION_LABELS[dim.dimension].padEnd(14);
    const bar = scoreBar(dim.score);
    const scoreStr = `${dim.score}/10`.padStart(5);
    const color = dim.score >= 7 ? GREEN : dim.score >= 4 ? YELLOW : RED;
    lines.push(`  ${label} ${color}${bar}${RESET}  ${scoreStr}  ${DIM}${dim.summary}${RESET}`);
  }

  lines.push("");

  // Group findings by severity
  const errors = report.findings.filter((f) => f.severity === "error");
  const warnings = report.findings.filter((f) => f.severity === "warning");
  const infos = report.findings.filter((f) => f.severity === "info");

  if (errors.length > 0) {
    lines.push(`${RED}${BOLD}\u274c ERRORS (${errors.length})${RESET}`);
    for (const f of errors) {
      const loc = f.line ? ` ${DIM}(line ${f.line})${RESET}` : "";
      lines.push(`  ${f.message}${loc}`);
      if (f.suggestion) {
        lines.push(`    ${DIM}\u2192 ${f.suggestion}${RESET}`);
      }
    }
    lines.push("");
  }

  if (warnings.length > 0) {
    lines.push(`${YELLOW}${BOLD}\u26a0\ufe0f  WARNINGS (${warnings.length})${RESET}`);
    for (const f of warnings) {
      const loc = f.line ? ` ${DIM}(line ${f.line})${RESET}` : "";
      lines.push(`  ${f.message}${loc}`);
      if (f.suggestion) {
        lines.push(`    ${DIM}\u2192 ${f.suggestion}${RESET}`);
      }
    }
    lines.push("");
  }

  if (infos.length > 0) {
    lines.push(`${CYAN}${BOLD}\ud83d\udca1 SUGGESTIONS (${infos.length})${RESET}`);
    for (const f of infos) {
      const loc = f.line ? ` ${DIM}(line ${f.line})${RESET}` : "";
      lines.push(`  ${f.message}${loc}`);
      if (f.suggestion) {
        lines.push(`    ${DIM}\u2192 ${f.suggestion}${RESET}`);
      }
    }
    lines.push("");
  }

  // Hook migration list
  const hookFindings = report.findings.filter((f) =>
    f.message.includes("should be a")
  );
  if (hookFindings.length > 0) {
    lines.push(`${BOLD}\ud83d\udd27 MIGRATE TO HOOKS${RESET}`);
    for (const f of hookFindings) {
      const loc = f.line ? `Line ${f.line}: ` : "";
      lines.push(`  ${loc}${f.message}`);
    }
    lines.push("");
  }

  lines.push("\u2550".repeat(56));
  lines.push(
    `${DIM}claudemd-lint v0.1.0 \u00b7 github.com/codecoincognition/claudemd-lint${RESET}`
  );
  lines.push("");

  return lines.join("\n");
}

export function formatJson(report: LintReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatCi(report: LintReport): string {
  const lines: string[] = [];

  // GitHub Actions annotation format
  for (const finding of report.findings) {
    if (finding.severity === "info") continue; // Skip info in CI
    const level = finding.severity === "error" ? "error" : "warning";
    const file = report.filePath;
    const line = finding.line ?? 1;
    lines.push(
      `::${level} file=${file},line=${line}::${finding.message}${finding.suggestion ? " — " + finding.suggestion : ""}`
    );
  }

  lines.push("");
  lines.push(`CLAUDE.md score: ${report.overallScore}/10 (${report.verdict})`);

  // Exit code hint
  if (report.verdict === "poor") {
    lines.push("::error::CLAUDE.md quality is below acceptable threshold");
  }

  return lines.join("\n");
}
