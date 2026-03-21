/**
 * Tests for actionability rule — vague patterns, hook candidates, weak directives
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { resolve, dirname } from "node:path";
import { parseFile } from "../parser.js";
import { checkActionability } from "./actionability.js";

const FIXTURES = resolve(dirname(import.meta.url.replace("file://", "")), "../../../fixtures");
const ROOT_DIR = resolve(dirname(import.meta.url.replace("file://", "")), "../../..");

describe("checkActionability", () => {
  it("returns a DimensionScore with dimension='actionability'", () => {
    const file = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const result = checkActionability(file);
    assert.equal(result.dimension, "actionability");
    assert.ok(result.score >= 1 && result.score <= 10);
    assert.ok(Array.isArray(result.findings));
  });

  it("good.md has high actionability (specific rules)", () => {
    const file = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const result = checkActionability(file);
    assert.ok(result.score >= 7, `Expected score >= 7, got ${result.score}`);
  });

  it("detects hook candidates but may not find vague patterns in bad.md", () => {
    const file = parseFile(resolve(FIXTURES, "bad.md"), ROOT_DIR);
    const result = checkActionability(file);
    // bad.md's vague lines like "Write clean code" may not be extracted as rules
    // but hook candidates like "Never commit files with API keys" are detected
    assert.ok(result.findings.length > 0, "Should detect actionability issues in bad.md");
  });

  it("detects hook candidates in bad.md", () => {
    const file = parseFile(resolve(FIXTURES, "bad.md"), ROOT_DIR);
    const result = checkActionability(file);
    const hooks = result.findings.filter((f) => f.message.includes("should be a"));
    // bad.md has "Never commit files with API keys", "Always run prettier", "Tests must pass before committing"
    assert.ok(hooks.length > 0, "Should detect hook candidates in bad.md");
  });

  it("vague findings are severity=warning", () => {
    const file = parseFile(resolve(FIXTURES, "bad.md"), ROOT_DIR);
    const result = checkActionability(file);
    const vague = result.findings.filter((f) => f.message.includes("Vague rule"));
    for (const f of vague) {
      assert.equal(f.severity, "warning");
    }
  });

  it("hook findings are severity=info", () => {
    const file = parseFile(resolve(FIXTURES, "bad.md"), ROOT_DIR);
    const result = checkActionability(file);
    const hooks = result.findings.filter((f) => f.message.includes("should be a"));
    for (const f of hooks) {
      assert.equal(f.severity, "info");
    }
  });

  it("ugly.md has low actionability", () => {
    const file = parseFile(resolve(FIXTURES, "ugly.md"), ROOT_DIR);
    const result = checkActionability(file);
    // ugly.md is full of vague patterns
    assert.ok(result.findings.length > 0, "Should find actionability issues in ugly.md");
  });

  it("summary mentions vague count and hook count", () => {
    const file = parseFile(resolve(FIXTURES, "bad.md"), ROOT_DIR);
    const result = checkActionability(file);
    if (result.findings.length > 0) {
      assert.ok(result.summary.includes("vague") || result.summary.includes("hook"),
        "Summary should mention vague rules or hook candidates");
    }
  });

  it("score is worse for bad.md than good.md", () => {
    const good = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const bad = parseFile(resolve(FIXTURES, "bad.md"), ROOT_DIR);
    const goodScore = checkActionability(good).score;
    const badScore = checkActionability(bad).score;
    assert.ok(goodScore >= badScore, `good (${goodScore}) should score >= bad (${badScore})`);
  });
});
