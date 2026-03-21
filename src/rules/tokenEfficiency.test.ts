/**
 * Tests for tokenEfficiency rule — word count, prose walls, verbose patterns
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { resolve, dirname } from "node:path";
import { parseFile } from "../parser.js";
import { checkTokenEfficiency } from "./tokenEfficiency.js";

const FIXTURES = resolve(dirname(import.meta.url.replace("file://", "")), "../../../fixtures");
const ROOT_DIR = resolve(dirname(import.meta.url.replace("file://", "")), "../../..");

describe("checkTokenEfficiency", () => {
  it("returns a DimensionScore with dimension='tokenEfficiency'", () => {
    const file = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const result = checkTokenEfficiency(file);
    assert.equal(result.dimension, "tokenEfficiency");
    assert.ok(result.score >= 1 && result.score <= 10);
    assert.ok(Array.isArray(result.findings));
  });

  it("good.md has high token efficiency (small, structured file)", () => {
    const file = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const result = checkTokenEfficiency(file);
    assert.ok(result.score >= 8, `Expected score >= 8, got ${result.score}`);
  });

  it("summary includes word count and token estimate", () => {
    const file = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const result = checkTokenEfficiency(file);
    assert.ok(result.summary.includes("words"), "Summary should mention words");
    assert.ok(result.summary.includes("tokens"), "Summary should mention tokens");
  });

  it("detects verbose patterns in bad.md", () => {
    const file = parseFile(resolve(FIXTURES, "bad.md"), ROOT_DIR);
    const result = checkTokenEfficiency(file);
    // bad.md has "When you are working", "please make sure to", "It is important to", "In order to"
    const verboseFindings = result.findings.filter(
      (f) => f.severity === "info" && f.message.toLowerCase().includes("order to") ||
             f.message.toLowerCase().includes("preamble") ||
             f.message.toLowerCase().includes("ensure") ||
             f.message.toLowerCase().includes("important")
    );
    assert.ok(verboseFindings.length > 0, "Should detect verbose patterns in bad.md");
  });

  it("does not penalize good.md for verbose patterns", () => {
    const file = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const result = checkTokenEfficiency(file);
    const verboseFindings = result.findings.filter((f) => f.severity === "info");
    // good.md should have very few or no verbose pattern findings
    assert.ok(verboseFindings.length <= 1, `Expected <= 1 verbose findings, got ${verboseFindings.length}`);
  });

  it("score is higher for smaller files", () => {
    const good = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const ugly = parseFile(resolve(FIXTURES, "ugly.md"), ROOT_DIR);
    const goodScore = checkTokenEfficiency(good).score;
    const uglyScore = checkTokenEfficiency(ugly).score;
    assert.ok(
      goodScore >= uglyScore,
      `good (${goodScore}) should score >= ugly (${uglyScore})`
    );
  });

  it("all findings have dimension=tokenEfficiency", () => {
    const file = parseFile(resolve(FIXTURES, "bad.md"), ROOT_DIR);
    const result = checkTokenEfficiency(file);
    for (const f of result.findings) {
      assert.equal(f.dimension, "tokenEfficiency");
    }
  });
});
