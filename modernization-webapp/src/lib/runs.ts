import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PythonValidation } from "@/lib/python-validation";

export type RunEvent = { at: string; stage: string; message: string; status: "pending" | "running" | "passed" | "failed" };
export type Run = {
  id: string; workerToken: string; repositoryUrl: string; installationId: number;
  scope: { mode: "whole" | "specific"; paths: string[] }; targets: Record<string, string>;
  status: "awaiting_agent" | "running" | "awaiting_result" | "completed" | "failed"; events: RunEvent[];
  branch?: string; pullRequestUrl?: string; createdAt: string; updatedAt: string;
  noChanges?: boolean;
  result?: { functionalChanges: string[]; technicalChanges: string[]; verification: string[]; limitations: string[]; pythonValidation?: PythonValidation };
};

const file = () => process.env.RUN_STORE_PATH ?? path.join(process.cwd(), ".runtime", "verimodern-runs.json");
async function all(): Promise<Run[]> { try { return JSON.parse(await readFile(file(), "utf8")); } catch { return []; } }
async function save(runs: Run[]) { await mkdir(path.dirname(file()), { recursive: true }); const temporary = `${file()}.tmp`; await writeFile(temporary, JSON.stringify(runs, null, 2)); await rename(temporary, file()); }

export async function createRun(input: Omit<Run, "id" | "workerToken" | "events" | "status" | "createdAt" | "updatedAt">) {
  const now = new Date().toISOString();
  const run: Run = { ...input, id: randomUUID(), workerToken: randomBytes(24).toString("base64url"), status: "awaiting_agent", events: [{ at: now, stage: "work order", message: "Waiting for the local Claude CLI worker.", status: "pending" }], createdAt: now, updatedAt: now };
  const runs = await all(); runs.push(run); await save(runs); return run;
}
export async function getRun(id: string) { return (await all()).find((run) => run.id === id) ?? null; }
export async function updateRun(id: string, mutate: (run: Run) => void) { const runs = await all(); const run = runs.find((item) => item.id === id); if (!run) return null; mutate(run); run.updatedAt = new Date().toISOString(); await save(runs); return run; }
export function validWorkerToken(run: Run, value: unknown) { return typeof value === "string" && value.length === run.workerToken.length && value === run.workerToken; }
