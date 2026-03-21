/**
 * Fixer module — auto-fixes common issues found by the linter.
 *
 * Conservative by design: only fixes things it's confident about.
 * Preserves file structure, headings, and section order.
 */

import type { Finding } from "./types.js";

export interface FixAction {
  type:
    | "remove-boilerplate"
    | "remove-duplicate"
    | "trim-filler"
    | "trim-whitespace"
    | "add-timestamp"
    | "add-vague-marker";
  line?: number;
  description: string;
}

export interface FixResult {
  content: string;
  actions: FixAction[];
  summary: string;
}

// ── Boilerplate patterns (mirrors redundancy.ts) ──────────────────────

const BOILERPLATE_PATTERNS = [
  /^[-*]\s*write clean code\s*$/i,
  /^[-*]\s*follow best practices\s*$/i,
  /^[-*]\s*use meaningful variable names\s*$/i,
  /^[-*]\s*add comments where necessary\s*$/i,
  /^[-*]\s*keep functions small\s*$/i,
  /^[-*]\s*don'?t repeat yourself\s*$/i,
  /^[-*]\s*write readable code\s*$/i,
  /^[-*]\s*follow (?:the )?(?:DRY|SOLID|KISS) princip/i,
  /^[-*]\s*handle errors? (?:properly|gracefully|appropriately|correctly)\s*$/i,
  /^[-*]\s*write (?:good |comprehensive )?tests\s*$/i,
  /^[-*]\s*use descriptive (?:variable )?names\s*$/i,
  /^[-*]\s*keep it simple\s*$/i,
  /^[-*]\s*make sure the code works\s*$/i,
  /^[-*]\s*don'?t break things\s*$/i,
  /^[-*]\s*think before you code\s*$/i,
  /^[-*]\s*consider edge cases\s*$/i,
  /^[-*]\s*use common sense\s*$/i,
  /^[-*]\s*keep things? (?:clean|organized|tidy)\s*$/i,
  /^[-*]\s*test everything\s*$/i,
  /^[-*]\s*be careful\s*$/i,
];

// ── Verbose filler phrases ────────────────────────────────────────────

const FILLER_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bit is important to\b/gi, ""],
  [/\bit is essential to\b/gi, ""],
  [/\bit is critical to\b/gi, ""],
  [/\bit is crucial to\b/gi, ""],
  [/\bin order to\b/gi, "to"],
  [/\bplease make sure to\b/gi, ""],
  [/\bplease ensure that you\b/gi, ""],
  [/\bplease make sure that\b/gi, ""],
  [/\bplease remember to\b/gi, ""],
  [/\bensure that you\b/gi, ""],
  [/\bwhen you are working on\b/gi, "when working on"],
  [/\bwhen you are\b/gi, "when"],
];

// ── Vague rule patterns (mirrors actionability.ts) ────────────────────

const VAGUE_LINE_PATTERNS = [
  /write (?:good|clean|proper|quality|nice|better) (?:code|tests|documentation)/i,
  /handle errors? (?:properly|gracefully|well|appropriately|correctly)/i,
  /follow (?:the )?(?:team|company|org|project) (?:standards?|conventions?|guidelines?|patterns?)/i,
  /keep (?:things?|code|it) (?:simple|clean|organized|tidy|neat)/i,
  /use (?:appropriate|suitable|proper|correct|right) (?:naming|patterns?|conventions?)/i,
  /be (?:careful|mindful|aware) (?:of|about|with|when)/i,
];

const TODO_MARKER = " <!-- TODO: make this more specific -->";

// ── Timestamp detection (mirrors maintainability.ts) ──────────────────

const TIMESTAMP_PATTERN =
  /(?:last\s+)?(?:updated|modified|reviewed|edited)\s*:?\s*\d{4}/i;
const DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;

function hasTimestamp(content: string): boolean {
  return TIMESTAMP_PATTERN.test(content) || DATE_PATTERN.test(content);
}

// ── Main fixer ────────────────────────────────────────────────────────

export function fix(content: string, findings: Finding[]): FixResult {
  const lines = content.split("\n");
  const actions: FixAction[] = [];

  // Track lines to remove (by 0-based index)
  const linesToRemove = new Set<number>();

  // 1. Remove boilerplate lines
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    for (const pattern of BOILERPLATE_PATTERNS) {
      if (pattern.test(trimmed)) {
        linesToRemove.add(i);
        actions.push({
          type: "remove-boilerplate",
          line: i + 1,
          description: `Remove boilerplate: "${trimmed}"`,
        });
        break;
      }
    }
  }

  // 2. Remove exact duplicate lines (keep first occurrence)
  const seenLines = new Map<string, number>();
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.length < 10) continue;
    if (trimmed.startsWith("#") || trimmed.startsWith("```")) continue;
    if (linesToRemove.has(i)) continue;

    const prev = seenLines.get(trimmed);
    if (prev !== undefined) {
      linesToRemove.add(i);
      actions.push({
        type: "remove-duplicate",
        line: i + 1,
        description: `Remove duplicate of line ${prev + 1}: "${trimmed.slice(0, 60)}"`,
      });
    } else {
      seenLines.set(trimmed, i);
    }
  }

  // 3. Apply filler phrase replacements (on lines not being removed)
  const fillerFixed: Map<number, string> = new Map();
  for (let i = 0; i < lines.length; i++) {
    if (linesToRemove.has(i)) continue;

    let line = lines[i];
    let changed = false;

    for (const [pattern, replacement] of FILLER_REPLACEMENTS) {
      if (pattern.test(line)) {
        line = line.replace(pattern, replacement);
        changed = true;
      }
    }

    if (changed) {
      // Clean up: collapse multiple spaces, trim trailing space
      line = line.replace(/ {2,}/g, " ").replace(/^ ([-*]) /, "$1 ");
      // Capitalize first letter after list marker if replacement left it lowercase
      line = line.replace(/^([-*]\s+)([a-z])/, (_m, prefix, ch) => prefix + ch.toUpperCase());
      // If the line became just a list marker or whitespace, remove it
      if (/^\s*[-*]?\s*$/.test(line)) {
        linesToRemove.add(i);
        actions.push({
          type: "trim-filler",
          line: i + 1,
          description: `Remove line (became empty after trimming filler)`,
        });
      } else {
        fillerFixed.set(i, line);
        actions.push({
          type: "trim-filler",
          line: i + 1,
          description: `Trim filler phrase on line ${i + 1}`,
        });
      }
    }
  }

  // 4. Add vague rule markers (on lines not being removed, not already marked)
  const vagueMarked: Map<number, string> = new Map();
  for (let i = 0; i < lines.length; i++) {
    if (linesToRemove.has(i)) continue;

    const line = fillerFixed.get(i) ?? lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("```")) continue;
    // Don't double-mark
    if (trimmed.includes(TODO_MARKER.trim())) continue;

    for (const pattern of VAGUE_LINE_PATTERNS) {
      if (pattern.test(trimmed)) {
        vagueMarked.set(i, line.trimEnd() + TODO_MARKER);
        actions.push({
          type: "add-vague-marker",
          line: i + 1,
          description: `Mark vague rule for review: "${trimmed.slice(0, 50)}"`,
        });
        break;
      }
    }
  }

  // 5. Build the result lines
  const resultLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (linesToRemove.has(i)) continue;

    let line = fillerFixed.get(i) ?? lines[i];
    line = vagueMarked.get(i) ?? line;
    resultLines.push(line);
  }

  // 6. Trim excessive whitespace (3+ blank lines → 2)
  let whitespaceFixed = 0;
  const compacted: string[] = [];
  let blankCount = 0;
  for (const line of resultLines) {
    if (line.trim() === "") {
      blankCount++;
      if (blankCount <= 2) {
        compacted.push(line);
      } else {
        whitespaceFixed++;
      }
    } else {
      blankCount = 0;
      compacted.push(line);
    }
  }
  if (whitespaceFixed > 0) {
    actions.push({
      type: "trim-whitespace",
      description: `Trimmed ${whitespaceFixed} excessive blank line(s)`,
    });
  }

  // 7. Add timestamp if missing
  let finalLines = compacted;
  if (!hasTimestamp(content)) {
    const today = new Date().toISOString().slice(0, 10);
    const timestampLine = `*Last updated: ${today}*`;

    // Insert after the first heading, or at the top if no heading
    const firstHeadingIdx = finalLines.findIndex((l) => /^#{1,6}\s+/.test(l));
    if (firstHeadingIdx >= 0) {
      // Insert after the heading with a blank line
      finalLines.splice(firstHeadingIdx + 1, 0, "", timestampLine);
    } else {
      // No heading — put at very top
      finalLines.unshift(timestampLine, "");
    }
    actions.push({
      type: "add-timestamp",
      description: `Add "Last updated: ${today}" after first heading`,
    });
  }

  // Build summary
  const counts: Record<string, number> = {};
  for (const a of actions) {
    counts[a.type] = (counts[a.type] ?? 0) + 1;
  }

  const parts: string[] = [];
  if (counts["remove-boilerplate"])
    parts.push(`Removed ${counts["remove-boilerplate"]} boilerplate line(s)`);
  if (counts["remove-duplicate"])
    parts.push(`Removed ${counts["remove-duplicate"]} duplicate line(s)`);
  if (counts["trim-filler"])
    parts.push(`Trimmed ${counts["trim-filler"]} filler phrase(s)`);
  if (counts["trim-whitespace"])
    parts.push(`Trimmed excessive whitespace`);
  if (counts["add-timestamp"]) parts.push(`Added timestamp`);
  if (counts["add-vague-marker"])
    parts.push(
      `Marked ${counts["add-vague-marker"]} vague rule(s) for review`
    );

  return {
    content: finalLines.join("\n"),
    actions,
    summary: parts.length > 0 ? parts.join(", ") : "No fixes applied",
  };
}
