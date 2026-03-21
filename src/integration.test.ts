/**
 * Integration tests — full lint pipeline on each fixture file
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { resolve, dirname } from "node:path";
import { lint } from "./scorer.js";
import { parseFile } from "./parser.js";
import { formatTerminal, formatJson, formatCi } from "./reporter.js";
import { DEFAULT_CONFIG } from "./types.js";
import type { LintConfig, LintReport } from "./types.js";

const FIXTURES = resolve(dirname(import.meta.url.replace("file://", "")), "../../fixtures");
const ROOT_DIR = resolve(dirname(import.meta.url.replace("file://", "")), "../..");

function makeConfig(overrides?: Partial<LintConfig>): LintConfig {
  return { ...DEFAULT_CONFIG, rootDir: ROOT_DIR, ...overrides };
}

describe("Integration: full pipeline", () => {
  describe("good.md", () => {
    let report: LintReport;

    it("runs the full pipeline without errors", () => {
      report = lint(resolve(FIXTURES, "good.md"), makeConfig());
      assert.ok(report);
    });

    it("scores >= 7", () => {
      report = lint(resolve(FIXTURES, "good.md"), makeConfig());
      assert.ok(
        report.overallScore >= 7,
        `good.md should score >= 7, got ${report.overallScore}`
      );
    });

    it("has verdict 'excellent' or 'good'", () => {
      report = lint(resolve(FIXTURES, "good.md"), makeConfig());
      assert.ok(
        report.verdict === "excellent" || report.verdict === "good",
        `Expected excellent or good, got: ${report.verdict}`
      );
    });

    it("has 7 dimension scores", () => {
      report = lint(resolve(FIXTURES, "good.md"), makeConfig());
      assert.equal(report.dimensions.length, 7);
    });

    it("has few error-level findings", () => {
      report = lint(resolve(FIXTURES, "good.md"), makeConfig());
      const errors = report.findings.filter((f) => f.severity === "error");
      assert.ok(errors.length <= 3, `Expected <= 3 errors, got ${errors.length}`);
    });
  });

  describe("bad.md", () => {
    let report: LintReport;

    it("runs the full pipeline without errors", () => {
      report = lint(resolve(FIXTURES, "bad.md"), makeConfig());
      assert.ok(report);
    });

    it("scores between 2 and 8", () => {
      report = lint(resolve(FIXTURES, "bad.md"), makeConfig());
      assert.ok(
        report.overallScore >= 2 && report.overallScore <= 8,
        `bad.md should score 2-8, got ${report.overallScore}`
      );
    });

    it("has multiple findings", () => {
      report = lint(resolve(FIXTURES, "bad.md"), makeConfig());
      assert.ok(
        report.findings.length >= 5,
        `bad.md should have >= 5 findings, got ${report.findings.length}`
      );
    });

    it("has findings across multiple dimensions", () => {
      report = lint(resolve(FIXTURES, "bad.md"), makeConfig());
      const dims = new Set(report.findings.map((f) => f.dimension));
      assert.ok(dims.size >= 3, `Findings should span >= 3 dimensions, got ${dims.size}`);
    });
  });

  describe("ugly.md", () => {
    let report: LintReport;

    it("runs the full pipeline without errors", () => {
      report = lint(resolve(FIXTURES, "ugly.md"), makeConfig());
      assert.ok(report);
    });

    it("scores between 1 and 7", () => {
      report = lint(resolve(FIXTURES, "ugly.md"), makeConfig());
      assert.ok(
        report.overallScore >= 1 && report.overallScore <= 7,
        `ugly.md should score 1-7, got ${report.overallScore}`
      );
    });

    it("has many findings", () => {
      report = lint(resolve(FIXTURES, "ugly.md"), makeConfig());
      assert.ok(
        report.findings.length >= 8,
        `ugly.md should have >= 8 findings, got ${report.findings.length}`
      );
    });

    it("has 'needs-work' or 'poor' verdict", () => {
      report = lint(resolve(FIXTURES, "ugly.md"), makeConfig());
      assert.ok(
        report.verdict === "needs-work" || report.verdict === "poor",
        `Expected needs-work or poor, got: ${report.verdict}`
      );
    });
  });

  describe("broken.md", () => {
    let report: LintReport;

    it("runs the full pipeline without errors", () => {
      report = lint(resolve(FIXTURES, "broken.md"), makeConfig());
      assert.ok(report);
    });

    it("scores < 7", () => {
      report = lint(resolve(FIXTURES, "broken.md"), makeConfig());
      assert.ok(
        report.overallScore < 7,
        `broken.md should score < 7, got ${report.overallScore}`
      );
    });

    it("has error-level findings", () => {
      report = lint(resolve(FIXTURES, "broken.md"), makeConfig());
      const errors = report.findings.filter((f) => f.severity === "error");
      assert.ok(errors.length > 0, "broken.md should have error-level findings");
    });

    it("has stale reference findings", () => {
      report = lint(resolve(FIXTURES, "broken.md"), makeConfig());
      const stale = report.findings.filter(
        (f) => f.dimension === "staleness" && f.severity === "error"
      );
      assert.ok(stale.length > 0, "broken.md should have stale reference errors");
    });

    it("has consistency findings", () => {
      report = lint(resolve(FIXTURES, "broken.md"), makeConfig());
      const consistency = report.findings.filter(
        (f) => f.dimension === "consistency"
      );
      assert.ok(consistency.length > 0, "broken.md should have consistency findings");
    });
  });
});

describe("Integration: parse → rules → score → report pipeline", () => {
  it("pipeline produces consistent results across formats", () => {
    const report = lint(resolve(FIXTURES, "good.md"), makeConfig());

    const terminal = formatTerminal(report);
    const json = formatJson(report);
    const ci = formatCi(report);

    // All formats should be non-empty
    assert.ok(terminal.length > 0);
    assert.ok(json.length > 0);
    assert.ok(ci.length > 0);

    // JSON should parse to same report
    const parsed = JSON.parse(json);
    assert.equal(parsed.overallScore, report.overallScore);
    assert.equal(parsed.verdict, report.verdict);
  });

  it("all fixtures produce valid reports", () => {
    for (const fixture of ["good.md", "bad.md", "ugly.md", "broken.md"]) {
      const report = lint(resolve(FIXTURES, fixture), makeConfig());
      assert.ok(report.overallScore >= 1 && report.overallScore <= 10, `${fixture}: score out of range`);
      assert.ok(report.dimensions.length === 7, `${fixture}: missing dimensions`);
      assert.ok(typeof report.verdict === "string", `${fixture}: missing verdict`);
      assert.ok(report.stats.lineCount > 0, `${fixture}: lineCount should be > 0`);
      assert.ok(report.stats.wordCount > 0, `${fixture}: wordCount should be > 0`);
    }
  });

  it("scores are ordered: good > bad > ugly for overall score", () => {
    const good = lint(resolve(FIXTURES, "good.md"), makeConfig());
    const bad = lint(resolve(FIXTURES, "bad.md"), makeConfig());
    const ugly = lint(resolve(FIXTURES, "ugly.md"), makeConfig());

    assert.ok(
      good.overallScore > bad.overallScore,
      `good (${good.overallScore}) should score higher than bad (${bad.overallScore})`
    );
    assert.ok(
      bad.overallScore >= ugly.overallScore,
      `bad (${bad.overallScore}) should score >= ugly (${ugly.overallScore})`
    );
  });

  it("finding counts increase with worse files", () => {
    const good = lint(resolve(FIXTURES, "good.md"), makeConfig());
    const ugly = lint(resolve(FIXTURES, "ugly.md"), makeConfig());

    assert.ok(
      ugly.findings.length > good.findings.length,
      `ugly (${ugly.findings.length} findings) should have more findings than good (${good.findings.length})`
    );
  });
});
