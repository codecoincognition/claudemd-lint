/**
 * Token Efficiency rule — measure context waste
 */

import type { ParsedFile, DimensionScore, Finding } from "../types.js";

// Rough token estimation: ~0.75 tokens per word for English text
const TOKENS_PER_WORD = 0.75;
const CONTEXT_WINDOW = 200_000;

// Thresholds
const WORD_CEILING = 10_000;
const WORD_WARNING = 5_000;
const PROSE_WALL_THRESHOLD = 500; // words in a section without structure

export function checkTokenEfficiency(file: ParsedFile): DimensionScore {
  const findings: Finding[] = [];
  const estimatedTokens = Math.round(file.wordCount * TOKENS_PER_WORD);
  const contextPercent = (estimatedTokens / CONTEXT_WINDOW) * 100;

  // Overall size check
  if (file.wordCount > WORD_CEILING) {
    findings.push({
      dimension: "tokenEfficiency",
      severity: "error",
      message: `File is ${file.wordCount.toLocaleString()} words (ceiling: ${WORD_CEILING.toLocaleString()})`,
      suggestion: `At ~${estimatedTokens.toLocaleString()} tokens, this file consumes ${contextPercent.toFixed(1)}% of the 200K context window on every request. Split into hierarchical files or trim aggressively.`,
    });
  } else if (file.wordCount > WORD_WARNING) {
    findings.push({
      dimension: "tokenEfficiency",
      severity: "warning",
      message: `File is ${file.wordCount.toLocaleString()} words — approaching ceiling`,
      suggestion: `At ~${estimatedTokens.toLocaleString()} tokens (${contextPercent.toFixed(1)}% of context). Review for content that could be moved to referenced docs.`,
    });
  }

  // Detect prose walls (sections with lots of text but no structure)
  for (const section of file.sections) {
    if (section.wordCount > PROSE_WALL_THRESHOLD) {
      const hasStructure =
        section.content.includes("- ") ||
        section.content.includes("* ") ||
        section.content.includes("1.") ||
        section.content.includes("```");

      if (!hasStructure) {
        findings.push({
          dimension: "tokenEfficiency",
          severity: "warning",
          message: `Prose wall in "${section.title}" (${section.wordCount} words, no structure)`,
          line: section.startLine + 1,
          suggestion: `Section "${section.title}" has ${section.wordCount} words of unstructured prose. Convert to bullet points or split into sub-sections. Claude processes structured content more reliably.`,
        });
      }
    }
  }

  // Check for verbose patterns that could be condensed
  const verbosePatterns: Array<[RegExp, string]> = [
    [
      /when (?:you are |you're )?(?:working|coding|writing|developing|building)/i,
      "Preamble can be removed — Claude knows it's working",
    ],
    [
      /please (?:make sure|ensure|remember) (?:to |that )?/i,
      "'Please ensure' adds words without value — state the rule directly",
    ],
    [
      /it is (?:important|essential|critical|crucial) (?:to |that )/i,
      "Drop 'it is important to' — just state what to do",
    ],
    [
      /in order to/i,
      "'In order to' → 'to'",
    ],
  ];

  let verboseCount = 0;
  for (let i = 0; i < file.lines.length; i++) {
    for (const [pattern, msg] of verbosePatterns) {
      if (pattern.test(file.lines[i])) {
        verboseCount++;
        if (verboseCount <= 3) {
          // Only report first 3 to avoid noise
          findings.push({
            dimension: "tokenEfficiency",
            severity: "info",
            message: msg,
            line: i + 1,
            suggestion: `Line ${i + 1}: Tighten this phrasing to save tokens.`,
          });
        }
      }
    }
  }

  if (verboseCount > 3) {
    findings.push({
      dimension: "tokenEfficiency",
      severity: "info",
      message: `${verboseCount} verbose phrases detected (showing first 3)`,
      suggestion: `Tighten phrasing throughout. Each unnecessary word costs ~0.75 tokens per request.`,
    });
  }

  // Score calculation
  let score = 10;
  if (file.wordCount > WORD_CEILING) score -= 4;
  else if (file.wordCount > WORD_WARNING) score -= 2;

  score -= findings.filter((f) => f.severity === "warning").length;
  score -= Math.floor(
    findings.filter((f) => f.severity === "info").length / 2
  );

  return {
    dimension: "tokenEfficiency",
    score: Math.max(1, Math.min(10, score)),
    findings,
    summary: `${file.wordCount.toLocaleString()} words (~${estimatedTokens.toLocaleString()} tokens, ${contextPercent.toFixed(1)}% of context)`,
  };
}
