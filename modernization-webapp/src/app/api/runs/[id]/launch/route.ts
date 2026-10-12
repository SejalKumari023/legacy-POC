import { spawn } from "node:child_process";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getRun, updateRun } from "@/lib/runs";
import { verify, type Session } from "@/lib/session";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const run = await getRun((await params).id);
  const session = verify<Session>((await cookies()).get("vm_session")?.value);
  if (!run || !session || session.installationId !== run.installationId) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  if (run.status !== "awaiting_agent") return NextResponse.json({ launched: false, status: run.status });
  const origin = new URL(request.url).origin;
  const directory = path.join(process.cwd(), ".runtime", "work-orders");
  const workOrderPath = path.join(directory, `${run.id}.json`);
  const workOrder = { runId: run.id, repositoryUrl: run.repositoryUrl, scope: run.scope, targets: run.targets, workerToken: run.workerToken, eventEndpoint: `${origin}/api/runs/${run.id}/events`, credentialEndpoint: `${origin}/api/runs/${run.id}/credentials`, pullRequestEndpoint: `${origin}/api/runs/${run.id}/pull-request`, resultEndpoint: `${origin}/api/runs/${run.id}/result` };
  await mkdir(directory, { recursive: true }); await writeFile(workOrderPath, JSON.stringify(workOrder, null, 2), { mode: 0o600 }); await chmod(workOrderPath, 0o600);
  const child = spawn(process.execPath, [path.join(process.cwd(), "scripts", "run-claude-work-order.mjs"), workOrderPath], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  await updateRun(run.id, (current) => {
    current.status = "running";
    current.events.push({ at: new Date().toISOString(), stage: "controller", message: "Background simulation worker started.", status: "running" });
  });
  return NextResponse.json({ launched: true, mode: "background-simulation" });
}
