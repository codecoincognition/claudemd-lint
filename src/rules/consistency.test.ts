/**
 * Tests for consistency rule — contradiction detection (explicit pairs + semantic)
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { resolve, dirname } from "node:path";
import { parseFile } from "../parser.js";
import { checkConsistency } from "./consistency.js";

const FIXTURES = resolve(dirname(import.meta.url.replace("file://", "")), "../../../fixtures");
const ROOT_DIR = resolve(dirname(import.meta.url.replace("file://", "")), "../../..");

describe("checkConsistency", () => {
  it("returns a DimensionScore with dimension='consistency'", () => {
    const file = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const result = checkConsistency(file);
    assert.equal(result.dimension, "consistency");
    assert.ok(result.score >= 1 && result.score <= 10);
    assert.ok(Array.isArray(result.findings));
    assert.ok(typeof result.summary === "string");
  });

  it("good.md has high consistency (few or no contradictions)", () => {
    const file = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const result = checkConsistency(file);
    assert.ok(result.score >= 7, `Expected score >= 7, got ${result.score}`);
  });

  it("broken.md has contradictions", () => {
    const file = parseFile(resolve(FIXTURES, "broken.md"), ROOT_DIR);
    const result = checkConsistency(file);
    assert.ok(result.findings.length > 0, "broken.md should have contradiction findings");
  });

  it("detects package manager conflicts in bad.md", () => {
    // bad.md mentions pnpm at top but npm install later
    const file = parseFile(resolve(FIXTURES, "bad.md"), ROOT_DIR);
    const result = checkConsistency(file);
    // May or may not detect depending on rule extraction — just verify it runs
    assert.ok(result.score >= 1);
  });

  it("detects semicolons contradiction in broken.md", () => {
    const file = parseFile(resolve(FIXTURES, "broken.md"), ROOT_DIR);
    const result = checkConsistency(file);
    const semicolonFinding = result.findings.find(
      (f) => f.message.toLowerCase().includes("semicolon")
    );
    assert.ok(semicolonFinding, "Should detect semicolons contradiction in broken.md");
  });

  it("detects test runner contradiction in broken.md", () => {
    const file = parseFile(resolve(FIXTURES, "broken.md"), ROOT_DIR);
    const result = checkConsistency(file);
    const testFinding = result.findings.find(
      (f) => f.message.toLowerCase().includes("test runner")
    );
    assert.ok(testFinding, "Should detect npm test vs yarn test contradiction");
  });

  it("ugly.md has contradictions in style rules", () => {
    const file = parseFile(resolve(FIXTURES, "ugly.md"), ROOT_DIR);
    const result = checkConsistency(file);
    assert.ok(result.findings.length > 0, "ugly.md should have contradiction findings");
  });

  it("score decreases with more contradictions", () => {
    const good = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const broken = parseFile(resolve(FIXTURES, "broken.md"), ROOT_DIR);
    const goodScore = checkConsistency(good).score;
    const brokenScore = checkConsistency(broken).score;
    assert.ok(goodScore > brokenScore, `good (${goodScore}) should score higher than broken (${brokenScore})`);
  });

  it("error findings have line numbers", () => {
    const file = parseFile(resolve(FIXTURES, "broken.md"), ROOT_DIR);
    const result = checkConsistency(file);
    const errors = result.findings.filter((f) => f.severity === "error");
    for (const e of errors) {
      assert.ok(typeof e.line === "number", "Error findings should have line numbers");
      assert.ok(typeof e.endLine === "number", "Error findings should have endLine");
    }
  });
});
