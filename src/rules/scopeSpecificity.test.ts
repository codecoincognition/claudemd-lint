/**
 * Tests for scopeSpecificity rule — monorepo hierarchy checks
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { resolve, dirname } from "node:path";
import { parseFile } from "../parser.js";
import { checkScopeSpecificity } from "./scopeSpecificity.js";

const FIXTURES = resolve(dirname(import.meta.url.replace("file://", "")), "../../../fixtures");
const ROOT_DIR = resolve(dirname(import.meta.url.replace("file://", "")), "../../..");

describe("checkScopeSpecificity", () => {
  it("returns a DimensionScore with dimension='scopeSpecificity'", () => {
    const file = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const result = checkScopeSpecificity(file, ROOT_DIR);
    assert.equal(result.dimension, "scopeSpecificity");
    assert.ok(result.score >= 1 && result.score <= 10);
    assert.ok(Array.isArray(result.findings));
    assert.ok(typeof result.summary === "string");
  });

  it("good.md has reasonable scope score", () => {
    const file = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const result = checkScopeSpecificity(file, ROOT_DIR);
    // good.md is well-scoped
    assert.ok(result.score >= 5, `Expected score >= 5, got ${result.score}`);
  });

  it("all findings have dimension=scopeSpecificity", () => {
    const file = parseFile(resolve(FIXTURES, "ugly.md"), ROOT_DIR);
    const result = checkScopeSpecificity(file, ROOT_DIR);
    for (const f of result.findings) {
      assert.equal(f.dimension, "scopeSpecificity");
    }
  });

  it("score is between 1 and 10 for all fixtures", () => {
    for (const fixture of ["good.md", "bad.md", "ugly.md", "broken.md"]) {
      const file = parseFile(resolve(FIXTURES, fixture), ROOT_DIR);
      const result = checkScopeSpecificity(file, ROOT_DIR);
      assert.ok(result.score >= 1, `${fixture}: score ${result.score} should be >= 1`);
      assert.ok(result.score <= 10, `${fixture}: score ${result.score} should be <= 10`);
    }
  });

  it("summary string is non-empty", () => {
    const file = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const result = checkScopeSpecificity(file, ROOT_DIR);
    assert.ok(result.summary.length > 0);
  });

  it("findings have valid severity", () => {
    const file = parseFile(resolve(FIXTURES, "ugly.md"), ROOT_DIR);
    const result = checkScopeSpecificity(file, ROOT_DIR);
    for (const f of result.findings) {
      assert.ok(
        ["error", "warning", "info"].includes(f.severity),
        `Invalid severity: ${f.severity}`
      );
    }
  });
});
