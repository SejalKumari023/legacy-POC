import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getRun } from "@/lib/runs";
import { verify, type Session } from "@/lib/session";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = verify<Session>((await cookies()).get("vm_session")?.value);
  const run = await getRun((await params).id);
  if (!session || !run || run.installationId !== session.installationId) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  const { workerToken, ...safe } = run;
  return NextResponse.json(safe);
}
