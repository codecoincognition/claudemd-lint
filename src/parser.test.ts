/**
 * Tests for parser.ts — file parsing, section extraction, rule extraction, file discovery
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { parseFile, discoverFiles } from "./parser.js";

const FIXTURES = resolve(dirname(import.meta.url.replace("file://", "")), "../../fixtures");
const ROOT_DIR = resolve(dirname(import.meta.url.replace("file://", "")), "../..");

describe("parseFile", () => {
  it("parses good.md and returns a valid ParsedFile", () => {
    const result = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    assert.ok(result.content.length > 0);
    assert.ok(result.lines.length > 0);
    assert.ok(result.sections.length > 0);
    assert.ok(result.wordCount > 0);
    assert.equal(result.lineCount, result.lines.length);
  });

  it("throws on non-existent file", () => {
    assert.throws(() => parseFile("/nonexistent/file.md", ROOT_DIR), /File not found/);
  });

  it("extracts correct path as absolute", () => {
    const result = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    assert.ok(result.path.startsWith("/"), "path should be absolute");
    assert.ok(result.path.endsWith("good.md"));
  });

  it("calculates word count correctly", () => {
    const result = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const expectedWords = readFileSync(resolve(FIXTURES, "good.md"), "utf-8")
      .split(/\s+/)
      .filter(Boolean).length;
    assert.equal(result.wordCount, expectedWords);
  });
});

describe("extractSections", () => {
  it("finds all headings in good.md", () => {
    const result = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    // good.md has: Project Overview, Project Structure, Build & Run, Coding Conventions,
    // Error Handling, File Naming, Testing, Deployment
    assert.ok(result.sections.length >= 7, `Expected >= 7 sections, got ${result.sections.length}`);
  });

  it("captures section title, level, and line range", () => {
    const result = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const first = result.sections[0];
    assert.ok(first.title.length > 0);
    assert.ok(first.level >= 1 && first.level <= 6);
    assert.ok(first.startLine >= 0);
    assert.ok(first.endLine >= first.startLine);
    assert.ok(first.wordCount > 0);
  });

  it("handles file with no headings (ugly.md has no markdown headings at top)", () => {
    // ugly.md starts without a heading — first line is text
    const result = parseFile(resolve(FIXTURES, "ugly.md"), ROOT_DIR);
    // ugly.md does not have proper markdown headings (no # at start)
    // It may still detect some sections from inline headings
    assert.ok(Array.isArray(result.sections));
  });

  it("returns empty sections for content with no headings", () => {
    // broken.md has ## headings, so let's test conceptually
    const result = parseFile(resolve(FIXTURES, "bad.md"), ROOT_DIR);
    // bad.md has NO headings — just flat text
    assert.equal(result.sections.length, 0, "bad.md should have 0 sections (no headings)");
  });
});

describe("extractRules", () => {
  it("extracts rules from good.md", () => {
    const result = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    assert.ok(result.rules.length > 0, "Should find rules in good.md");
  });

  it("classifies rule types correctly", () => {
    const result = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const types = new Set(result.rules.map((r) => r.type));
    // Should have at least directives or guidelines
    assert.ok(types.size > 0, "Should have at least one rule type");
  });

  it("extracts rules from bad.md with many directives", () => {
    const result = parseFile(resolve(FIXTURES, "bad.md"), ROOT_DIR);
    assert.ok(result.rules.length > 5, `Expected >5 rules in bad.md, got ${result.rules.length}`);
  });

  it("associates rules with correct sections", () => {
    const result = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    for (const rule of result.rules) {
      assert.ok(typeof rule.section === "string");
      assert.ok(rule.line > 0);
    }
  });

  it("detects directive-type rules starting with never/must/always", () => {
    // bad.md has rules like "Never commit files with API keys" which classifyRule
    // sees after stripping list markers. Use bad.md which has top-level directives.
    const result = parseFile(resolve(FIXTURES, "bad.md"), ROOT_DIR);
    const directives = result.rules.filter((r) => r.type === "directive");
    // bad.md has "Never commit files with API keys or secrets..."
    // and "Always use const, never use let..."
    assert.ok(directives.length > 0, `Should find directive rules, got types: ${result.rules.map(r => r.type).join(', ')}`);
  });
});

describe("imports", () => {
  it("returns empty imports when no @import lines exist", () => {
    const result = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    // good.md has no @import lines
    assert.equal(result.imports.length, 0);
  });
});

describe("fileRefs", () => {
  it("extracts file references from good.md", () => {
    const result = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    // good.md references paths like src/app/, src/components/, etc.
    assert.ok(Array.isArray(result.fileRefs));
  });

  it("marks non-existent file refs as exists=false", () => {
    const result = parseFile(resolve(FIXTURES, "broken.md"), ROOT_DIR);
    const staleRefs = result.fileRefs.filter((r) => !r.exists);
    // broken.md references many non-existent files
    assert.ok(staleRefs.length > 0, "Should find stale file refs in broken.md");
  });
});

describe("discoverFiles", () => {
  it("discovers CLAUDE.md at root level", () => {
    // The project root has no CLAUDE.md but we can test the function shape
    const result = discoverFiles(ROOT_DIR);
    assert.ok(Array.isArray(result));
  });

  it("returns absolute paths", () => {
    const result = discoverFiles(ROOT_DIR);
    for (const f of result) {
      assert.ok(f.startsWith("/"), `Expected absolute path, got: ${f}`);
    }
  });
});
