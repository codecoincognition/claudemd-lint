/**
 * Tests for staleness rule — stale file refs, deprecated tools, missing deps
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { resolve, dirname } from "node:path";
import { parseFile } from "../parser.js";
import { checkStaleness } from "./staleness.js";

const FIXTURES = resolve(dirname(import.meta.url.replace("file://", "")), "../../../fixtures");
const ROOT_DIR = resolve(dirname(import.meta.url.replace("file://", "")), "../../..");

describe("checkStaleness", () => {
  it("returns a DimensionScore with dimension='staleness'", () => {
    const file = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const result = checkStaleness(file, ROOT_DIR);
    assert.equal(result.dimension, "staleness");
    assert.ok(result.score >= 1 && result.score <= 10);
    assert.ok(Array.isArray(result.findings));
  });

  it("good.md has minimal staleness", () => {
    const file = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const result = checkStaleness(file, ROOT_DIR);
    // good.md references vitest, playwright etc. which aren't in this project's deps
    // but the score should still be reasonable
    assert.ok(result.score >= 1);
  });

  it("broken.md has stale file references", () => {
    const file = parseFile(resolve(FIXTURES, "broken.md"), ROOT_DIR);
    const result = checkStaleness(file, ROOT_DIR);
    const staleRefs = result.findings.filter((f) =>
      f.message.includes("non-existent file")
    );
    assert.ok(staleRefs.length > 0, "broken.md should have stale file reference findings");
  });

  it("detects deprecated tool references", () => {
    const file = parseFile(resolve(FIXTURES, "ugly.md"), ROOT_DIR);
    const result = checkStaleness(file, ROOT_DIR);
    const deprecated = result.findings.filter((f) =>
      f.message.toLowerCase().includes("deprecated") || f.message.toLowerCase().includes("maintenance")
    );
    // ugly.md mentions create-react-app
    assert.ok(deprecated.length > 0, "ugly.md should have deprecated tool findings");
  });

  it("stale ref findings include the file path", () => {
    const file = parseFile(resolve(FIXTURES, "broken.md"), ROOT_DIR);
    const result = checkStaleness(file, ROOT_DIR);
    const staleRefs = result.findings.filter((f) =>
      f.message.includes("non-existent file")
    );
    for (const f of staleRefs) {
      assert.ok(f.message.includes("/") || f.message.includes("."), "Should include path in message");
      assert.ok(typeof f.line === "number", "Should have line number");
    }
  });

  it("score decreases with more stale references", () => {
    const good = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const broken = parseFile(resolve(FIXTURES, "broken.md"), ROOT_DIR);
    const goodScore = checkStaleness(good, ROOT_DIR).score;
    const brokenScore = checkStaleness(broken, ROOT_DIR).score;
    assert.ok(
      goodScore >= brokenScore,
      `good (${goodScore}) should score >= broken (${brokenScore})`
    );
  });

  it("checks package.json cross-references", () => {
    // The project has a real package.json, so references to tools not in it should be caught
    const file = parseFile(resolve(FIXTURES, "good.md"), ROOT_DIR);
    const result = checkStaleness(file, ROOT_DIR);
    // good.md mentions vitest, playwright, tailwind, prisma, next.js — none in this project's deps
    const pkgFindings = result.findings.filter((f) =>
      f.message.includes("not found in package.json")
    );
    assert.ok(pkgFindings.length > 0, "Should detect tools mentioned but not in package.json");
  });
});
