export type PythonValidation = {
  profile: "python-3.8-to-3.12";
  baseline: { runtime: string; requiresPython: string; testsPassed: true; testCount: number; behaviorCaptured: true; errors: [] };
  target: { runtime: string; requiresPython: string; testsPassed: true; testCount: number; behaviorCaptured: true; errors: [] };
  behavior: { matched: true; caseCount: number; baselineSha256: string; targetSha256: string };
  passed: true;
};

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

export function parsePythonValidation(value: unknown): PythonValidation | null {
  if (!object(value) || value.profile !== "python-3.8-to-3.12" || value.passed !== true) return null;
  const { baseline, target, behavior } = value;
  if (!object(baseline) || !object(target) || !object(behavior)) return null;
  const validRun = (run: Record<string, unknown>, version: RegExp) =>
    typeof run.runtime === "string" && version.test(run.runtime) &&
    run.testsPassed === true && Number.isInteger(run.testCount) && Number(run.testCount) > 0 &&
    run.behaviorCaptured === true && Array.isArray(run.errors) && run.errors.length === 0;
  const hash = /^[0-9a-f]{64}$/;
  if (!validRun(baseline, /^3\.8\.\d+$/) || !validRun(target, /^3\.12\.\d+$/) ||
      typeof baseline.requiresPython !== "string" || !baseline.requiresPython.includes("3.8") ||
      typeof target.requiresPython !== "string" || !target.requiresPython.includes("3.12") || target.requiresPython.includes("3.8") ||
      behavior.matched !== true || !Number.isInteger(behavior.caseCount) || Number(behavior.caseCount) < 1 ||
      typeof behavior.baselineSha256 !== "string" || !hash.test(behavior.baselineSha256) ||
      behavior.baselineSha256 !== behavior.targetSha256) return null;
  return value as PythonValidation;
}

export function pythonVerificationLines(report: PythonValidation) {
  return [
    `Baseline Python ${report.baseline.runtime}: ${report.baseline.testCount} tests passed.`,
    `Target Python ${report.target.runtime}: ${report.target.testCount} tests passed.`,
    `${report.behavior.caseCount} behavior cases matched, including outputs and exceptions (SHA-256 ${report.behavior.targetSha256}).`,
  ];
}
