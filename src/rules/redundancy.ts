/**
 * Redundancy rule — detect duplicate and overlapping rules
 */

import type { ParsedFile, DimensionScore, Finding } from "../types.js";

// Common boilerplate that adds no project-specific value
const BOILERPLATE_PATTERNS = [
  /write clean code/i,
  /follow best practices/i,
  /use meaningful variable names/i,
  /add comments where necessary/i,
  /keep functions small/i,
  /don't repeat yourself/i,
  /write readable code/i,
  /follow (?:the )?(?:DRY|SOLID|KISS) princip/i,
  /handle errors? (?:properly|gracefully|appropriately|correctly)/i,
  /write (?:good |comprehensive )?tests/i,
  /use descriptive (?:variable )?names/i,
  /keep it simple/i,
  /follow (?:the )?(?:coding |team )?(?:standards?|conventions?)/i,
  /make sure the code works/i,
  /don'?t break things/i,
  /think before you code/i,
  /consider edge cases/i,
  /use common sense/i,
  /keep things? (?:clean|organized|tidy)/i,
  /errors? should be (?:caught|handled)/i,
  /make sure (?:errors? are |to )handle/i,
  /be careful\b/i,
  /test everything/i,
];

/**
 * Simple similarity check — normalized Jaccard index on 4+ char words
 */
function similarity(a: string, b: string): number {
  const wordsA = new Set(
    a.toLowerCase().match(/\b\w{4,}\b/g) ?? []
  );
  const wordsB = new Set(
    b.toLowerCase().match(/\b\w{4,}\b/g) ?? []
  );
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union;
}

export function checkRedundancy(file: ParsedFile): DimensionScore {
  const findings: Finding[] = [];

  // Check for boilerplate rules
  for (const rule of file.rules) {
    for (const pattern of BOILERPLATE_PATTERNS) {
      if (pattern.test(rule.text)) {
        findings.push({
          dimension: "redundancy",
          severity: "info",
          message: `Generic boilerplate: "${rule.text.slice(0, 60)}"`,
          line: rule.line,
          suggestion: `This is generic advice Claude already follows. Remove unless it addresses a specific project problem.`,
        });
        break;
      }
    }
  }

  // Check for duplicate/overlapping rules
  for (let i = 0; i < file.rules.length; i++) {
    for (let j = i + 1; j < file.rules.length; j++) {
      const sim = similarity(file.rules[i].text, file.rules[j].text);
      if (sim > 0.6) {
        findings.push({
          dimension: "redundancy",
          severity: "warning",
          message: `Rules appear to overlap (${Math.round(sim * 100)}% similarity)`,
          line: file.rules[i].line,
          endLine: file.rules[j].line,
          suggestion: `Line ${file.rules[i].line}: "${file.rules[i].text.slice(0, 50)}" overlaps with Line ${file.rules[j].line}: "${file.rules[j].text.slice(0, 50)}". Consolidate into one rule.`,
        });
      }
    }
  }

  // Check for exact duplicate lines
  const lineMap = new Map<string, number[]>();
  for (let i = 0; i < file.lines.length; i++) {
    const trimmed = file.lines[i].trim();
    if (trimmed.length < 10) continue; // Skip short/empty lines
    if (trimmed.startsWith("#") || trimmed.startsWith("```")) continue;

    const existing = lineMap.get(trimmed);
    if (existing) {
      existing.push(i + 1);
    } else {
      lineMap.set(trimmed, [i + 1]);
    }
  }

  for (const [text, lineNums] of lineMap) {
    if (lineNums.length > 1) {
      findings.push({
        dimension: "redundancy",
        severity: "warning",
        message: `Exact duplicate content on lines ${lineNums.join(", ")}`,
        line: lineNums[0],
        suggestion: `"${text.slice(0, 60)}" appears ${lineNums.length} times. Keep one instance and remove the rest.`,
      });
    }
  }

  const boilerplateCount = findings.filter((f) => f.severity === "info").length;
  const dupeCount = findings.filter((f) => f.severity === "warning").length;
  const score = Math.max(
    1,
    10 - dupeCount * 2 - Math.floor(boilerplateCount / 2)
  );

  return {
    dimension: "redundancy",
    score,
    findings,
    summary:
      findings.length === 0
        ? "No redundancy detected"
        : `${dupeCount} duplicate(s) and ${boilerplateCount} boilerplate rule(s) found`,
  };
}
