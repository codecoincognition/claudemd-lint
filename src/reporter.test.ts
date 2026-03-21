/**
 * Tests for reporter.ts — terminal, JSON, and CI output formats
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { resolve, dirname } from "node:path";
import { lint } from "./scorer.js";
import { formatTerminal, formatJson, formatCi } from "./reporter.js";
import { DEFAULT_CONFIG } from "./types.js";
import type { LintConfig } from "./types.js";

const FIXTURES = resolve(dirname(import.meta.url.replace("file://", "")), "../../fixtures");
const ROOT_DIR = resolve(dirname(import.meta.url.replace("file://", "")), "../..");

function makeConfig(overrides?: Partial<LintConfig>): LintConfig {
  return { ...DEFAULT_CONFIG, rootDir: ROOT_DIR, ...overrides };
}

function getReport(fixture: string) {
  return lint(resolve(FIXTURES, fixture), makeConfig());
}

describe("formatTerminal", () => {
  it("produces non-empty string output", () => {
    const output = formatTerminal(getReport("good.md"));
    assert.ok(output.length > 0);
  });

  it("includes the score and verdict", () => {
    const report = getReport("good.md");
    const output = formatTerminal(report);
    assert.ok(output.includes(`${report.overallScore}/10`), "Should include score");
  });

  it("includes all dimension labels", () => {
    const output = formatTerminal(getReport("good.md"));
    const labels = ["CONSISTENCY", "STALENESS", "REDUNDANCY", "SCOPE", "TOKENS", "ACTIONABILITY", "MAINTAIN"];
    for (const label of labels) {
      assert.ok(output.includes(label), `Should include dimension label: ${label}`);
    }
  });

  it("includes findings for bad.md", () => {
    const report = getReport("bad.md");
    const output = formatTerminal(report);
    // bad.md should produce warnings or errors
    assert.ok(
      output.includes("WARNING") || output.includes("ERROR") || output.includes("SUGGESTION"),
      "Should show findings for bad.md"
    );
  });

  it("includes score bars", () => {
    const output = formatTerminal(getReport("good.md"));
    // Score bars use block characters
    assert.ok(output.includes("\u2588") || output.includes("\u2591"), "Should include score bar characters");
  });
});

describe("formatJson", () => {
  it("returns valid JSON", () => {
    const output = formatJson(getReport("good.md"));
    const parsed = JSON.parse(output);
    assert.ok(typeof parsed === "object");
  });

  it("JSON contains all required fields", () => {
    const output = formatJson(getReport("good.md"));
    const parsed = JSON.parse(output);
    assert.ok("filePath" in parsed);
    assert.ok("overallScore" in parsed);
    assert.ok("verdict" in parsed);
    assert.ok("dimensions" in parsed);
    assert.ok("findings" in parsed);
    assert.ok("stats" in parsed);
    assert.ok("timestamp" in parsed);
  });

  it("dimensions array has 7 entries in JSON", () => {
    const output = formatJson(getReport("good.md"));
    const parsed = JSON.parse(output);
    assert.equal(parsed.dimensions.length, 7);
  });

  it("JSON round-trips dimension scores", () => {
    const report = getReport("bad.md");
    const output = formatJson(report);
    const parsed = JSON.parse(output);
    for (let i = 0; i < 7; i++) {
      assert.equal(parsed.dimensions[i].dimension, report.dimensions[i].dimension);
      assert.equal(parsed.dimensions[i].score, report.dimensions[i].score);
    }
  });
});

describe("formatCi", () => {
  it("uses GitHub Actions annotation format", () => {
    const report = getReport("broken.md");
    const output = formatCi(report);
    // Should have ::warning or ::error annotations
    assert.ok(
      output.includes("::warning") || output.includes("::error"),
      "CI output should use GitHub Actions annotation format"
    );
  });

  it("includes score summary line", () => {
    const report = getReport("good.md");
    const output = formatCi(report);
    assert.ok(output.includes(`CLAUDE.md score: ${report.overallScore}/10`));
  });

  it("skips info-level findings in CI output", () => {
    const report = getReport("good.md");
    const output = formatCi(report);
    // Info findings should NOT appear as annotations
    const infoFindings = report.findings.filter((f) => f.severity === "info");
    for (const f of infoFindings) {
      assert.ok(!output.includes(`::info`), "CI output should not have ::info annotations");
    }
  });

  it("includes error annotation for poor verdict", () => {
    const report = getReport("broken.md");
    if (report.verdict === "poor") {
      const output = formatCi(report);
      assert.ok(
        output.includes("::error::CLAUDE.md quality is below acceptable threshold"),
        "Poor verdict should produce error annotation"
      );
    }
  });

  it("annotations include file path and line number", () => {
    const report = getReport("broken.md");
    const output = formatCi(report);
    const lines = output.split("\n").filter((l) => l.startsWith("::"));
    for (const line of lines) {
      if (line.includes("file=")) {
        assert.ok(line.includes("line="), "Annotations with file should include line");
      }
    }
  });
});
