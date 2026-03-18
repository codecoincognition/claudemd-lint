/**
 * CLAUDE.md parser — reads files, resolves @imports, extracts structure
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { ParsedFile, Section, Rule, ImportRef, FileRef } from "./types.js";

const IMPORT_PATTERN = /^@([\w.\/\-]+)/gm;
const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/;
const FILE_REF_PATTERN =
  /(?:`([^`]+\.[a-z]+)`|(?:^|\s)(\.?\/[\w.\-\/]+\.[a-z]+))/g;
const RULE_INDICATORS = [
  /^[-*]\s/,
  /^\d+\.\s/,
  /^(always|never|must|should|prefer|avoid|do not|don't|use|ensure)/i,
  /\b(always|never|must not|do not|don't)\b.*\b(use|commit|push|write|run|add)\b/i,
  /\buse\s+(react|typescript|tailwind|prisma|next|vue|angular|express|jest|vitest|mocha|pnpm|yarn|npm|bun)\b/i,
  /^we use\b/i,
  /^the project uses?\b/i,
  /\bIMPORTANT:/i,
];

export function parseFile(filePath: string, rootDir: string): ParsedFile {
  const absPath = resolve(filePath);
  if (!existsSync(absPath)) {
    throw new Error(`File not found: ${absPath}`);
  }

  const content = readFileSync(absPath, "utf-8");
  const lines = content.split("\n");
  const sections = extractSections(lines);
  const rules = extractRules(lines, sections);
  const imports = resolveImports(content, dirname(absPath));
  const fileRefs = extractFileRefs(content, lines, rootDir);

  return {
    path: absPath,
    content,
    lines,
    sections,
    rules,
    imports,
    fileRefs,
    wordCount: content.split(/\s+/).filter(Boolean).length,
    lineCount: lines.length,
  };
}

function extractSections(lines: string[]): Section[] {
  const sections: Section[] = [];
  let currentSection: Partial<Section> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(HEADING_PATTERN);
    if (match) {
      if (currentSection) {
        currentSection.endLine = i - 1;
        currentSection.content = lines
          .slice(currentSection.startLine!, currentSection.endLine! + 1)
          .join("\n");
        currentSection.wordCount = currentSection
          .content!.split(/\s+/)
          .filter(Boolean).length;
        sections.push(currentSection as Section);
      }
      currentSection = {
        title: match[2],
        level: match[1].length,
        startLine: i,
      };
    }
  }

  if (currentSection) {
    currentSection.endLine = lines.length - 1;
    currentSection.content = lines
      .slice(currentSection.startLine!, currentSection.endLine! + 1)
      .join("\n");
    currentSection.wordCount = currentSection
      .content!.split(/\s+/)
      .filter(Boolean).length;
    sections.push(currentSection as Section);
  }

  return sections;
}

function extractRules(lines: string[], sections: Section[]): Rule[] {
  const rules: Rule[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#") || line.startsWith("```")) continue;

    const isRule = RULE_INDICATORS.some((pat) => pat.test(line));
    if (isRule) {
      const section =
        sections.find((s) => i >= s.startLine && i <= s.endLine)?.title ??
        "(root)";
      rules.push({
        text: line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, ""),
        line: i + 1,
        section,
        type: classifyRule(line),
      });
    }
  }

  return rules;
}

function classifyRule(
  line: string
): "directive" | "guideline" | "example" | "reference" {
  const lower = line.toLowerCase();
  if (/^(never|must|always|do not|don't|ensure)/i.test(lower))
    return "directive";
  if (/^(prefer|should|consider|try to)/i.test(lower)) return "guideline";
  if (/^(e\.g\.|example|for instance)/i.test(lower)) return "example";
  return "reference";
}

function resolveImports(content: string, fileDir: string): ImportRef[] {
  const imports: ImportRef[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^@([\w.\/\-]+)/);
    if (match) {
      const importPath = resolve(fileDir, match[1]);
      imports.push({
        path: match[1],
        line: i + 1,
        resolved: existsSync(importPath),
      });
    }
  }

  return imports;
}

function extractFileRefs(
  content: string,
  lines: string[],
  rootDir: string
): FileRef[] {
  const refs: FileRef[] = [];
  const seen = new Set<string>();
  let inCodeBlock = false;

  // Patterns that indicate an example, not a real file reference
  const EXAMPLE_INDICATORS = /\(.*`[^`]+`.*\)|e\.g\.|example|such as|like /i;
  // Glob patterns and wildcards are not real file paths
  const GLOB_PATTERN = /[*?{}\[\]]/;
  // CLI commands that contain file-like paths but aren't file references
  const CLI_COMMAND_PATTERN = /^\s*[-*]?\s*(?:`[^`]*`\s*$|.*\b(?:kubectl|docker|terraform|helm|aws|gcloud|az|npm|yarn|pnpm|npx|pip|cargo|go)\s+)/i;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Skip lines that are clearly showing examples/naming conventions
    if (EXAMPLE_INDICATORS.test(lines[i])) continue;
    // Skip lines that are CLI commands containing file-like args
    if (CLI_COMMAND_PATTERN.test(lines[i])) continue;

    let match: RegExpExecArray | null;
    const regex = new RegExp(FILE_REF_PATTERN.source, "g");
    while ((match = regex.exec(lines[i])) !== null) {
      const refPath = match[1] || match[2];
      if (!refPath || seen.has(refPath)) continue;
      // Skip globs, wildcards, and bare filenames without path separators
      // (e.g., `UserProfile.tsx` is a naming example, not a real path)
      if (GLOB_PATTERN.test(refPath)) continue;
      if (!refPath.includes("/") && match[1]) continue; // backtick ref without path = example

      seen.add(refPath);
      const absRef = resolve(rootDir, refPath);
      refs.push({
        path: refPath,
        line: i + 1,
        exists: existsSync(absRef),
      });
    }
  }

  return refs;
}

/**
 * Discover all CLAUDE.md files in a monorepo hierarchy
 */
export function discoverFiles(rootDir: string): string[] {
  const files: string[] = [];
  const root = resolve(rootDir, "CLAUDE.md");
  if (existsSync(root)) files.push(root);

  // Check common subdirectories
  try {
    const entries = readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        entry.name !== "node_modules"
      ) {
        const childPath = resolve(rootDir, entry.name, "CLAUDE.md");
        if (existsSync(childPath)) files.push(childPath);
      }
    }
  } catch {
    // Permission denied or other errors — skip
  }

  // Check .claude/local.md
  const localPath = resolve(rootDir, ".claude", "CLAUDE.md");
  if (existsSync(localPath)) files.push(localPath);

  return files;
}
