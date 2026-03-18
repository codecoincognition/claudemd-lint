/**
 * Consistency rule — detect contradictory instructions
 */

import type { ParsedFile, DimensionScore, Finding } from "../types.js";

// Pairs of concepts that often conflict
const CONFLICT_PAIRS: Array<[RegExp, RegExp, string]> = [
  [/\buse\s+npm\b/i, /\buse\s+pnpm\b/i, "package manager"],
  [/\buse\s+npm\b/i, /\buse\s+yarn\b/i, "package manager"],
  [/\buse\s+npm\b/i, /\buse\s+bun\b/i, "package manager"],
  [/\buse\s+pnpm\b/i, /\buse\s+yarn\b/i, "package manager"],
  [/\buse\s+pnpm\b/i, /\buse\s+bun\b/i, "package manager"],
  [/\buse\s+yarn\b/i, /\buse\s+bun\b/i, "package manager"],
  [/\basync\/await\b/i, /\bpromise\s+chain/i, "async pattern"],
  [/\bOAuth2?\b/i, /\bAPI\s+key/i, "auth strategy"],
  [/\bnever\s+use\s+any\b/i, /\bany\b.*allowed/i, "TypeScript any"],
  [/\btabs\b/i, /\bspaces\b/i, "indentation"],
  [/\bsemicolons?\b.*required/i, /\bno\s+semicolons?\b/i, "semicolons"],
  [/\bsingle\s+quotes?\b/i, /\bdouble\s+quotes?\b/i, "quote style"],
  [/\bconst\b.*prefer/i, /\blet\b.*prefer/i, "variable declaration"],
  [/\bclass\b.*component/i, /\bfunctional\b.*component/i, "React component style"],
  [/\bREST\b/i, /\bGraphQL\b/i, "API style"],
  [/\bvitest\b/i, /\bjest\b/i, "test framework"],
  [/\bmocha\b/i, /\bjest\b/i, "test framework"],
];

// Negation patterns that create direct contradictions
const NEGATION_PAIRS: Array<[RegExp, RegExp]> = [
  [/\bnever\b.*\b(\w+)\b/i, /\balways\b.*\b(\w+)\b/i],
  [/\bdo\s+not\b.*\b(\w+)\b/i, /\bmust\b.*\b(\w+)\b/i],
  [/\bavoid\b.*\b(\w+)\b/i, /\bprefer\b.*\b(\w+)\b/i],
];

export function checkConsistency(file: ParsedFile): DimensionScore {
  const findings: Finding[] = [];

  // Check conflict pairs across all rules
  for (const [patA, patB, topic] of CONFLICT_PAIRS) {
    const matchesA = file.rules.filter((r) => patA.test(r.text) && !patB.test(r.text));
    const matchesB = file.rules.filter((r) => patB.test(r.text) && !patA.test(r.text));

    if (matchesA.length > 0 && matchesB.length > 0) {
      // Only flag if the matches are on different lines
      const a = matchesA[0];
      const b = matchesB[0];
      if (a.line !== b.line) {
        findings.push({
          dimension: "consistency",
          severity: "error",
          message: `Contradictory ${topic} instructions`,
          line: a.line,
          endLine: b.line,
          suggestion: `Choose one ${topic} strategy. Line ${a.line}: "${a.text.slice(0, 60)}" conflicts with Line ${b.line}: "${b.text.slice(0, 60)}"`,
        });
      }
    }
  }

  // Check for direct negation contradictions within similar topics
  for (const rule of file.rules) {
    for (const otherRule of file.rules) {
      if (rule.line >= otherRule.line) continue;
      if (rule.section === otherRule.section) {
        // Same section — check for "never X" vs "always X" style conflicts
        const rLower = rule.text.toLowerCase();
        const oLower = otherRule.text.toLowerCase();

        if (
          (rLower.includes("never") && oLower.includes("always")) ||
          (rLower.includes("always") && oLower.includes("never"))
        ) {
          // Extract key nouns and check overlap
          const rWords = new Set(rLower.match(/\b\w{4,}\b/g) ?? []);
          const oWords = new Set(oLower.match(/\b\w{4,}\b/g) ?? []);
          const overlap = [...rWords].filter(
            (w) =>
              oWords.has(w) &&
              !["always", "never", "should", "must", "that", "this", "with"].includes(w)
          );

          if (overlap.length >= 1) {
            findings.push({
              dimension: "consistency",
              severity: "warning",
              message: `Potential contradiction on "${overlap.join(", ")}"`,
              line: rule.line,
              endLine: otherRule.line,
              suggestion: `Line ${rule.line} and Line ${otherRule.line} may conflict. Review and reconcile.`,
            });
          }
        }
      }
    }
  }

  const score = Math.max(1, 10 - findings.filter((f) => f.severity === "error").length * 3 - findings.filter((f) => f.severity === "warning").length);

  return {
    dimension: "consistency",
    score,
    findings,
    summary:
      findings.length === 0
        ? "No contradictions detected"
        : `${findings.length} potential contradiction(s) found`,
  };
}
