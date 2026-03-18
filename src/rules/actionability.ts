/**
 * Actionability rule — check if rules are specific enough for Claude to follow
 */

import type { ParsedFile, DimensionScore, Finding } from "../types.js";

// Vague patterns that Claude can't reliably act on
const VAGUE_PATTERNS: Array<[RegExp, string]> = [
  [
    /write (?:good|clean|proper|quality|nice|better) (?:code|tests|documentation)/i,
    "Too vague — specify what 'good' means (e.g., 'every function must have JSDoc')",
  ],
  [
    /handle errors? (?:properly|gracefully|well|appropriately|correctly)/i,
    "Too vague — specify the pattern (e.g., 'wrap all async calls in try/catch and log to stderr')",
  ],
  [
    /follow (?:the )?(?:team|company|org|project) (?:standards?|conventions?|guidelines?|patterns?)/i,
    "Too vague — list the actual standards or link to a specific document",
  ],
  [
    /keep (?:things?|code|it) (?:simple|clean|organized|tidy|neat)/i,
    "Too vague — define what 'simple' means for this project",
  ],
  [
    /use (?:appropriate|suitable|proper|correct|right) (?:naming|patterns?|conventions?)/i,
    "Too vague — specify the naming convention (e.g., 'camelCase for functions, PascalCase for components')",
  ],
  [
    /be (?:careful|mindful|aware) (?:of|about|with|when)/i,
    "Too vague — convert to a specific rule (e.g., 'never mutate state directly')",
  ],
  [
    /consider (?:using|adding|implementing)/i,
    "'Consider' is a suggestion, not a rule. Make it a directive ('use X') or remove it.",
  ],
  [
    /try to (?:avoid|minimize|reduce|limit)/i,
    "'Try to' is weak — either make it a rule ('never') or a guideline ('prefer')",
  ],
];

// Rules that should be hooks instead of CLAUDE.md instructions
const HOOK_CANDIDATES: Array<[RegExp, string, string]> = [
  [
    /never commit (?:files? with )?(?:API|secret|private)?\s?keys?/i,
    "PreToolUse hook",
    "Intercept Bash(git commit) to check for secrets before committing",
  ],
  [
    /always run (?:prettier|eslint|format)/i,
    "PostToolUse hook",
    "Auto-run formatter after file edits via Write/Edit tool hooks",
  ],
  [
    /tests? must pass (?:before|prior to) committ/i,
    "PreToolUse hook",
    "Run test suite before allowing git commit",
  ],
  [
    /never (?:push|commit) (?:to |directly to )?(?:main|master)/i,
    "PreToolUse hook",
    "Block git push to main/master branches",
  ],
  [
    /always (?:add|include|write) (?:a )?(?:test|spec)/i,
    "PostToolUse hook",
    "Verify test file exists after creating source files",
  ],
  [
    /never (?:delete|remove|modify) (?:\.env|config|secret)/i,
    "PreToolUse hook",
    "Block file operations on sensitive config files",
  ],
  [
    /run (?:type[- ]?check|tsc) (?:before|after)/i,
    "PostToolUse hook",
    "Auto-run type-checking after TypeScript file changes",
  ],
  [
    /never commit \.env/i,
    "PreToolUse hook",
    "Check staged files for .env before git commit",
  ],
];

export function checkActionability(file: ParsedFile): DimensionScore {
  const findings: Finding[] = [];

  // Check for vague rules
  for (const rule of file.rules) {
    for (const [pattern, suggestion] of VAGUE_PATTERNS) {
      if (pattern.test(rule.text)) {
        findings.push({
          dimension: "actionability",
          severity: "warning",
          message: `Vague rule: "${rule.text.slice(0, 60)}"`,
          line: rule.line,
          suggestion,
        });
        break; // One finding per rule
      }
    }
  }

  // Check for rules that should be hooks
  for (const rule of file.rules) {
    for (const [pattern, hookType, hookDesc] of HOOK_CANDIDATES) {
      if (pattern.test(rule.text)) {
        findings.push({
          dimension: "actionability",
          severity: "info",
          message: `Rule should be a ${hookType}: "${rule.text.slice(0, 60)}"`,
          line: rule.line,
          suggestion: `This rule is unenforceable via CLAUDE.md but trivial as a ${hookType}. ${hookDesc}. See: https://docs.anthropic.com/en/docs/claude-code/hooks`,
        });
        break;
      }
    }
  }

  // Check for rules without clear directive language
  let weakRules = 0;
  for (const rule of file.rules) {
    if (rule.type === "guideline") {
      const hasWeakLanguage = /^(maybe|perhaps|you could|you might|it would be nice)/i.test(
        rule.text
      );
      if (hasWeakLanguage) {
        weakRules++;
        if (weakRules <= 2) {
          findings.push({
            dimension: "actionability",
            severity: "info",
            message: `Weak directive: "${rule.text.slice(0, 60)}"`,
            line: rule.line,
            suggestion: `Rewrite as a clear directive ('use X', 'prefer Y', 'never Z') or remove`,
          });
        }
      }
    }
  }

  const vagueCount = findings.filter(
    (f) => f.severity === "warning"
  ).length;
  const hookCount = findings.filter(
    (f) => f.message.includes("should be a")
  ).length;

  let score = 10;
  score -= vagueCount * 1.5;
  score -= Math.floor(hookCount / 2);
  score -= Math.floor(weakRules / 3);

  return {
    dimension: "actionability",
    score: Math.max(1, Math.min(10, Math.round(score))),
    findings,
    summary:
      findings.length === 0
        ? "All rules are specific and actionable"
        : `${vagueCount} vague rule(s), ${hookCount} hook candidate(s)`,
  };
}
