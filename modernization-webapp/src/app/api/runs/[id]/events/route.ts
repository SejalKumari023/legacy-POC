import { NextResponse } from "next/server";
import { getRun, updateRun, validWorkerToken, type RunEvent } from "@/lib/runs";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const run = await getRun((await params).id);
  const body = await request.json() as { workerToken?: string; event?: Omit<RunEvent, "at">; runStatus?: "awaiting_agent" | "running" | "awaiting_result" | "completed" | "failed" };
  if (!run || !validWorkerToken(run, body.workerToken) || !body.event) return NextResponse.json({ error: "Invalid worker credential or event" }, { status: 401 });
  const updated = await updateRun(run.id, (current) => { current.events.push({ ...body.event!, at: new Date().toISOString() }); current.status = body.runStatus ?? (body.event!.status === "failed" ? "failed" : "running"); });
  return NextResponse.json({ status: updated?.status });
}
