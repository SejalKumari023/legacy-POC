import { NextResponse } from "next/server";
import { installationToken } from "@/lib/github";
import { getRun, validWorkerToken } from "@/lib/runs";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const run = await getRun((await params).id);
  const workerToken = request.headers.get("x-worker-token");
  if (!run || !validWorkerToken(run, workerToken)) return NextResponse.json({ error: "Invalid worker credential" }, { status: 401 });
  try {
    const token = await installationToken(run.installationId);
    return NextResponse.json({ token, repositoryUrl: run.repositoryUrl, expiresInMinutes: 55 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Credential minting failed" }, { status: 400 });
  }
}
