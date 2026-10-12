import { NextResponse } from "next/server";
import { parsePythonValidation, pythonVerificationLines } from "@/lib/python-validation";
import { getRun, updateRun, validWorkerToken } from "@/lib/runs";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const run = await getRun((await params).id);
  const body = await request.json() as { workerToken?: string; functionalChanges?: string[]; technicalChanges?: string[]; verification?: string[]; limitations?: string[]; pythonValidation?: unknown; noChanges?: boolean };
  if (!run || !validWorkerToken(run, body.workerToken)) return NextResponse.json({ error: "Invalid worker credential" }, { status: 401 });
  const pythonCase = run.targets.Python === "3.12";
  const pythonValidation = pythonCase ? parsePythonValidation(body.pythonValidation) : undefined;
  if (pythonCase && !pythonValidation) {
    await updateRun(run.id, (current) => { current.status = "failed"; current.events.push({ at: new Date().toISOString(), stage: "verification", message: "Python 3.8→3.12 runtime, tests, and behavior evidence did not pass validation.", status: "failed" }); });
    return NextResponse.json({ error: "Python 3.8→3.12 verification evidence is required before a PR." }, { status: 422 });
  }
  const result = { functionalChanges: body.functionalChanges ?? [], technicalChanges: body.technicalChanges ?? [], verification: [...(body.verification ?? []), ...(pythonValidation ? pythonVerificationLines(pythonValidation) : [])], limitations: body.limitations ?? [], ...(pythonValidation ? { pythonValidation } : {}) };
  const updated = await updateRun(run.id, (current) => { current.result = result; current.noChanges = body.noChanges === true; current.status = current.pullRequestUrl || current.noChanges ? "completed" : "running"; current.events.push({ at: new Date().toISOString(), stage: "result", message: current.noChanges ? "No code change was needed; evidence received." : "Functional and technical evidence received.", status: "passed" }); });
  return NextResponse.json({ status: updated?.status });
}
