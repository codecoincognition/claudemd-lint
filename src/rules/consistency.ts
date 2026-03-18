/**
 * Consistency rule — detect contradictory instructions
 */

import type { ParsedFile, DimensionScore, Finding } from "../types.js";

// Pairs of concepts that often conflict
const CONFLICT_PAIRS: Array<[RegExp, RegExp, string]> = [
  // Package managers
  [/\buse\s+npm\b/i, /\buse\s+pnpm\b/i, "package manager"],
  [/\buse\s+npm\b/i, /\buse\s+yarn\b/i, "package manager"],
  [/\buse\s+npm\b/i, /\buse\s+bun\b/i, "package manager"],
  [/\buse\s+pnpm\b/i, /\buse\s+yarn\b/i, "package manager"],
  [/\buse\s+pnpm\b/i, /\buse\s+bun\b/i, "package manager"],
  [/\buse\s+yarn\b/i, /\buse\s+bun\b/i, "package manager"],
  // Async patterns
  [/\basync\/await\b/i, /\bpromise\s+chain/i, "async pattern"],
  // Auth
  [/\bOAuth2?\b/i, /\bAPI\s+key/i, "auth strategy"],
  // TypeScript
  [/\bnever\s+use\s+any\b/i, /\bany\b.*allowed/i, "TypeScript any"],
  // Formatting
  [/\btabs\b/i, /\bspaces\b/i, "indentation"],
  [/\bsemicolons?\b.*required/i, /\bno\s+semicolons?\b/i, "semicolons"],
  [/\balways\b.*\bsemicolons?\b/i, /\bnever\b.*\bsemicolons?\b/i, "semicolons"],
  [/\bsingle\s+quotes?\b/i, /\bdouble\s+quotes?\b/i, "quote style"],
  [/\bconst\b.*prefer/i, /\blet\b.*prefer/i, "variable declaration"],
  // React
  [/\bclass\b.*component/i, /\bfunctional\b.*component/i, "React component style"],
  // API style
  [/\bREST\b/i, /\bGraphQL\b/i, "API style"],
  // Test frameworks
  [/\bvitest\b/i, /\bjest\b/i, "test framework"],
  [/\bmocha\b/i, /\bjest\b/i, "test framework"],
  [/\bmocha\b/i, /\bvitest\b/i, "test framework"],
  // Test runners
  [/\bnpm\s+test\b/i, /\byarn\s+test\b/i, "test runner"],
  // Infrastructure
  [/\bkubernetes\b|\bkubectl\b|\bk8s\b/i, /\bdon't\s+use\s+kubernetes\b|\bnot?\s+use\s+kubernetes\b|\bno\s+kubernetes\b|don't\s+use\s+k8s|we\s+don't\s+use\s+kubernetes/i, "infrastructure"],
  [/\bkubernetes\b|\bkubectl\b|\bk8s\b/i, /\buse\s+terraform\b|\bterraform\b.*instead/i, "infrastructure"],
  // Database mocking
  [/\bmock\b.*\bdatabase\b|\bmock\b.*\bdb\b/i, /\bnever\s+mock\b.*\bdatabase\b|\bnever\s+mock\b.*\bdb\b|\bdon't\s+mock\b.*\bdatabase\b|\bdo\s+not\s+mock\b.*\bdatabase\b|\breal\b.*\bconnection\b.*\bdatabase\b|\breal\b.*\bdatabase\b/i, "database mocking"],
  // Dependencies
  [/\bbanned\b|\bis\s+banned\b|\bdo\s+not\s+use\b|\bdon't\s+use\b|\bnever\s+use\b/i, /\bimport\b.*\bfrom\b|\buse\b.*\bwhen\s+needed\b/i, "banned dependency"],
  // Versioning
  [/\bdo\s+not\s+upgrade\b|\bdon't\s+upgrade\b|\bpinned\b|\block/i, /\blatest\s+version\b|\balways\s+upgrade\b|\bkeep.*up.to.date\b/i, "version strategy"],
  // Git workflow
  [/\bpush\b.*\bmain\b.*\bdeploy\b|\bauto.deploy\b.*\bmain\b|\bpush\s+to\s+main\b.*\btrigger/i, /\bnever\s+push\b.*\bmain\b|\bdon't\s+push\b.*\bmain\b|\bdo\s+not\s+push\b.*\bmain\b|\buse\s+PRs?\s+only\b/i, "git workflow"],
];

// Negation words and their opposites
const NEGATION_MARKERS = /\b(never|no|don't|do\s+not|avoid|banned|prohibited|forbidden|not\s+allowed)\b/i;
const AFFIRMATION_MARKERS = /\b(always|must|shall|ensure|require|use|prefer|import|run)\b/i;

// Stop words to ignore when comparing rule content
const STOP_WORDS = new Set([
  "always", "never", "should", "must", "shall", "that", "this", "with",
  "from", "have", "been", "will", "would", "could", "when", "where",
  "which", "their", "there", "they", "then", "than", "them", "these",
  "those", "your", "about", "into", "more", "some", "very", "just",
  "only", "also", "each", "every", "make", "like", "over", "such",
  "does", "done", "doing", "used", "using", "ensure", "avoid",
  "prefer", "don't", "do not", "require", "required", "allowed",
  "need", "keep", "want", "instead", "the", "for", "all", "any",
  "not", "are", "was", "were", "can", "may", "but", "and", "use",
  "run", "add", "set", "get", "put", "see", "new", "old",
]);

/**
 * Extract meaningful keywords from a rule (3+ chars, not stop words)
 */
function extractKeywords(text: string): Set<string> {
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) ?? [];
  return new Set(words.filter((w) => !STOP_WORDS.has(w)));
}

/**
 * Calculate Jaccard similarity between two keyword sets
 */
function keywordOverlap(a: Set<string>, b: Set<string>): { ratio: number; shared: string[] } {
  const shared = [...a].filter((w) => b.has(w));
  const union = new Set([...a, ...b]);
  return { ratio: union.size > 0 ? shared.length / union.size : 0, shared };
}

export function checkConsistency(file: ParsedFile): DimensionScore {
  const findings: Finding[] = [];
  const seen = new Set<string>(); // dedupe findings by line pairs

  // ── Pass 1: Check explicit conflict pairs across all rules ──
  for (const [patA, patB, topic] of CONFLICT_PAIRS) {
    const matchesA = file.rules.filter((r) => patA.test(r.text) && !patB.test(r.text));
    const matchesB = file.rules.filter((r) => patB.test(r.text) && !patA.test(r.text));

    if (matchesA.length > 0 && matchesB.length > 0) {
      const a = matchesA[0];
      const b = matchesB[0];
      if (a.line !== b.line) {
        const key = `${Math.min(a.line, b.line)}-${Math.max(a.line, b.line)}`;
        if (!seen.has(key)) {
          seen.add(key);
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
  }

  // ── Pass 2: Detect negation contradictions across ALL rules ──
  // Look for pairs where one rule negates and the other affirms the same topic
  for (let i = 0; i < file.rules.length; i++) {
    for (let j = i + 1; j < file.rules.length; j++) {
      const ruleA = file.rules[i];
      const ruleB = file.rules[j];
      const key = `${ruleA.line}-${ruleB.line}`;
      if (seen.has(key)) continue;

      const aText = ruleA.text.toLowerCase();
      const bText = ruleB.text.toLowerCase();

      const aNeg = NEGATION_MARKERS.test(aText);
      const bNeg = NEGATION_MARKERS.test(bText);
      const aAff = AFFIRMATION_MARKERS.test(aText);
      const bAff = AFFIRMATION_MARKERS.test(bText);

      // Skip if both rules have the same polarity — they reinforce, not contradict
      if (aNeg && bNeg) continue;
      if (aAff && !aNeg && bAff && !bNeg) continue;

      // One must negate and the other affirm
      const oppositePolarity = (aNeg && bAff && !bNeg) || (bNeg && aAff && !aNeg);
      if (!oppositePolarity) continue;

      // Check if they're talking about the same topic via keyword overlap
      const kwA = extractKeywords(aText);
      const kwB = extractKeywords(bText);
      const { ratio, shared } = keywordOverlap(kwA, kwB);

      // Require meaningful overlap — at least 2 shared keywords or 30%+ Jaccard
      if (shared.length >= 2 || (shared.length >= 1 && ratio >= 0.3)) {
        seen.add(key);
        findings.push({
          dimension: "consistency",
          severity: "warning",
          message: `Potential contradiction on "${shared.join(", ")}"`,
          line: ruleA.line,
          endLine: ruleB.line,
          suggestion: `Line ${ruleA.line}: "${ruleA.text.slice(0, 60)}" may conflict with Line ${ruleB.line}: "${ruleB.text.slice(0, 60)}". Review and reconcile.`,
        });
      }
    }
  }

  const errorCount = findings.filter((f) => f.severity === "error").length;
  const warnCount = findings.filter((f) => f.severity === "warning").length;
  const score = Math.max(1, 10 - errorCount * 3 - warnCount);

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
