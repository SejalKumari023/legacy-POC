import assert from "node:assert/strict";
import test from "node:test";
import { parsePythonValidation, pythonVerificationLines } from "../src/lib/python-validation.ts";

const report = () => ({
  profile: "python-3.8-to-3.12",
  baseline: { runtime: "3.8.20", requiresPython: ">=3.8,<3.9", testsPassed: true, testCount: 6, behaviorCaptured: true, errors: [] },
  target: { runtime: "3.12.12", requiresPython: ">=3.12,<3.13", testsPassed: true, testCount: 6, behaviorCaptured: true, errors: [] },
  behavior: { matched: true, caseCount: 6, baselineSha256: "a".repeat(64), targetSha256: "a".repeat(64) },
  passed: true,
});

test("accepts actual-runtime, test, and matching-behavior evidence", () => {
  const parsed = parsePythonValidation(report());
  assert.ok(parsed);
  assert.match(pythonVerificationLines(parsed)[2], /6 behavior cases matched/);
});

test("rejects a report from the wrong interpreter", () => {
  const value = report();
  value.target.runtime = "3.11.11";
  assert.equal(parsePythonValidation(value), null);
});

test("rejects failing or missing behavior evidence", () => {
  const value = report();
  value.behavior.targetSha256 = "b".repeat(64);
  assert.equal(parsePythonValidation(value), null);
  value.behavior.targetSha256 = value.behavior.baselineSha256;
  value.target.testsPassed = false;
  assert.equal(parsePythonValidation(value), null);
});
