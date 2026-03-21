/**
 * Tests for redundancy rule — boilerplate detection, similarity, exact duplicates
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { resolve, dirname } from "node:path";
import { parseFile } from "../parser.js";
import { checkRedundancy } from "./redundancy.js";

const FIXTURES = resolve(dirname(import.meta.url.replace("file://", "")), "../../../fixtures");
const ROOT_DIR = resolve(dirname(import.meta.url.replace("file://", "")), "../../..");

describe("checkRedundancy", () => {
  it("returns a DimensionScore with dimension='redundancy'", () => {
    const file = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const result = checkRedundancy(file);
    assert.equal(result.dimension, "redundancy");
    assert.ok(result.score >= 1 && result.score <= 10);
    assert.ok(Array.isArray(result.findings));
  });

  it("good.md has low redundancy", () => {
    const file = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const result = checkRedundancy(file);
    assert.ok(result.score >= 7, `Expected score >= 7, got ${result.score}`);
  });

  it("detects boilerplate patterns in bad.md", () => {
    const file = parseFile(resolve(FIXTURES, "bad.md"), ROOT_DIR);
    const result = checkRedundancy(file);
    const boilerplate = result.findings.filter((f) =>
      f.message.includes("boilerplate")
    );
    // bad.md has "Write clean code", "Follow best practices", etc.
    assert.ok(boilerplate.length > 0, "Should detect boilerplate in bad.md");
  });

  it("detects redundancy issues in ugly.md (duplicates and overlaps)", () => {
    const file = parseFile(resolve(FIXTURES, "ugly.md"), ROOT_DIR);
    const result = checkRedundancy(file);
    // ugly.md has exact duplicates and overlapping rules
    assert.ok(result.findings.length > 0, "Should detect redundancy in ugly.md");
  });

  it("detects exact duplicate lines in ugly.md", () => {
    const file = parseFile(resolve(FIXTURES, "ugly.md"), ROOT_DIR);
    const result = checkRedundancy(file);
    const dupes = result.findings.filter((f) =>
      f.message.includes("Exact duplicate")
    );
    // ugly.md has "IMPORTANT: Never commit .env files" repeated 3 times
    assert.ok(dupes.length > 0, "Should detect exact duplicates in ugly.md");
  });

  it("detects similar/overlapping rules", () => {
    const file = parseFile(resolve(FIXTURES, "ugly.md"), ROOT_DIR);
    const result = checkRedundancy(file);
    const overlaps = result.findings.filter((f) =>
      f.message.includes("overlap")
    );
    // ugly.md has repetitive error handling rules
    assert.ok(overlaps.length > 0, "Should detect overlapping rules in ugly.md");
  });

  it("boilerplate findings are severity=info", () => {
    const file = parseFile(resolve(FIXTURES, "bad.md"), ROOT_DIR);
    const result = checkRedundancy(file);
    const boilerplate = result.findings.filter((f) => f.message.includes("boilerplate"));
    for (const f of boilerplate) {
      assert.equal(f.severity, "info");
    }
  });

  it("duplicate findings are severity=warning", () => {
    const file = parseFile(resolve(FIXTURES, "ugly.md"), ROOT_DIR);
    const result = checkRedundancy(file);
    const dupes = result.findings.filter((f) => f.message.includes("duplicate") || f.message.includes("overlap"));
    for (const f of dupes) {
      assert.equal(f.severity, "warning");
    }
  });

  it("score is worse for ugly.md than good.md", () => {
    const good = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const ugly = parseFile(resolve(FIXTURES, "ugly.md"), ROOT_DIR);
    const goodScore = checkRedundancy(good).score;
    const uglyScore = checkRedundancy(ugly).score;
    assert.ok(goodScore > uglyScore, `good (${goodScore}) should score higher than ugly (${uglyScore})`);
  });
});
