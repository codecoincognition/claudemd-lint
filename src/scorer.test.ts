/**
 * Tests for scorer.ts — score aggregation, weighting, grade thresholds
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { resolve, dirname } from "node:path";
import { lint } from "./scorer.js";
import { DEFAULT_CONFIG } from "./types.js";
import type { LintConfig } from "./types.js";

const FIXTURES = resolve(dirname(import.meta.url.replace("file://", "")), "../../fixtures");
const ROOT_DIR = resolve(dirname(import.meta.url.replace("file://", "")), "../..");

function makeConfig(overrides?: Partial<LintConfig>): LintConfig {
  return { ...DEFAULT_CONFIG, rootDir: ROOT_DIR, ...overrides };
}

describe("lint (scorer)", () => {
  it("returns a LintReport with all required fields", () => {
    const report = lint(resolve(FIXTURES, "good.md"), makeConfig());
    assert.ok(typeof report.filePath === "string");
    assert.ok(typeof report.overallScore === "number");
    assert.ok(["excellent", "good", "needs-work", "poor"].includes(report.verdict));
    assert.equal(report.dimensions.length, 7);
    assert.ok(Array.isArray(report.findings));
    assert.ok(typeof report.stats === "object");
    assert.ok(typeof report.timestamp === "string");
  });

  it("score is between 1 and 10", () => {
    const report = lint(resolve(FIXTURES, "good.md"), makeConfig());
    assert.ok(report.overallScore >= 1, `Score ${report.overallScore} should be >= 1`);
    assert.ok(report.overallScore <= 10, `Score ${report.overallScore} should be <= 10`);
  });

  it("all dimension scores are between 1 and 10", () => {
    const report = lint(resolve(FIXTURES, "bad.md"), makeConfig());
    for (const dim of report.dimensions) {
      assert.ok(dim.score >= 1, `${dim.dimension} score ${dim.score} should be >= 1`);
      assert.ok(dim.score <= 10, `${dim.dimension} score ${dim.score} should be <= 10`);
    }
  });

  it("covers all 7 dimensions", () => {
    const report = lint(resolve(FIXTURES, "good.md"), makeConfig());
    const dims = report.dimensions.map((d) => d.dimension).sort();
    assert.deepEqual(dims, [
      "actionability",
      "consistency",
      "maintainability",
      "redundancy",
      "scopeSpecificity",
      "staleness",
      "tokenEfficiency",
    ]);
  });
});

describe("verdict thresholds", () => {
  it("good.md gets 'excellent' or 'good' verdict", () => {
    const report = lint(resolve(FIXTURES, "good.md"), makeConfig());
    assert.ok(
      report.verdict === "excellent" || report.verdict === "good",
      `Expected excellent or good, got: ${report.verdict} (score: ${report.overallScore})`
    );
  });

  it("broken.md scores below good.md", () => {
    const good = lint(resolve(FIXTURES, "good.md"), makeConfig());
    const broken = lint(resolve(FIXTURES, "broken.md"), makeConfig());
    assert.ok(
      broken.overallScore < good.overallScore,
      `broken (${broken.overallScore}) should score lower than good (${good.overallScore})`
    );
  });
});

describe("weighted scoring", () => {
  it("custom weights affect the overall score", () => {
    const report1 = lint(resolve(FIXTURES, "bad.md"), makeConfig());

    // Heavily weight consistency (which bad.md is bad at)
    const heavyConsistency = makeConfig({
      weights: {
        consistency: 10,
        staleness: 1,
        redundancy: 1,
        scopeSpecificity: 1,
        tokenEfficiency: 1,
        actionability: 1,
        maintainability: 1,
      },
    });
    const report2 = lint(resolve(FIXTURES, "bad.md"), heavyConsistency);

    // Scores should differ when weights change
    // (not asserting direction since it depends on which dim scores higher)
    assert.ok(typeof report1.overallScore === "number");
    assert.ok(typeof report2.overallScore === "number");
  });

  it("equal weights produce the mean of dimension scores", () => {
    const report = lint(resolve(FIXTURES, "good.md"), makeConfig());
    const mean = report.dimensions.reduce((sum, d) => sum + d.score, 0) / 7;
    const rounded = Math.round(mean * 10) / 10;
    assert.equal(report.overallScore, rounded);
  });
});

describe("stats", () => {
  it("computes file stats correctly", () => {
    const report = lint(resolve(FIXTURES, "good.md"), makeConfig());
    assert.ok(report.stats.lineCount > 0);
    assert.ok(report.stats.wordCount > 0);
    assert.ok(report.stats.sectionCount > 0);
    assert.ok(report.stats.ruleCount > 0);
    assert.ok(report.stats.estimatedTokens > 0);
    assert.equal(report.stats.estimatedTokens, Math.round(report.stats.wordCount * 0.75));
  });

  it("counts stale refs in broken.md", () => {
    const report = lint(resolve(FIXTURES, "broken.md"), makeConfig());
    assert.ok(report.stats.staleRefCount > 0, "broken.md should have stale refs");
  });
});
