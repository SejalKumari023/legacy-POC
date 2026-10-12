import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertRepositoryAccess } from "@/lib/github";
import { createRun } from "@/lib/runs";
import { verify, type Session } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = verify<Session>((await cookies()).get("vm_session")?.value);
  if (!session) return NextResponse.json({ error: "Connect GitHub before creating a run." }, { status: 401 });
  try {
    const body = await request.json() as { repositoryUrl?: string; scope?: { mode?: "whole" | "specific"; paths?: string[] }; targets?: Record<string, string> };
    const repositoryUrl = body.repositoryUrl ?? session.repository;
    if (!repositoryUrl || !body.scope || !body.targets || Object.keys(body.targets).length === 0) throw new Error("Repository, scope, and at least one target are required.");
    if (body.scope.mode === "specific" && !body.scope.paths?.length) throw new Error("Select at least one file or folder.");
    await assertRepositoryAccess(session.installationId, repositoryUrl);
    const run = await createRun({ repositoryUrl, installationId: session.installationId, scope: { mode: body.scope.mode ?? "whole", paths: body.scope.paths ?? [] }, targets: body.targets });
    return NextResponse.json({ id: run.id, status: run.status }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Run could not be created" }, { status: 400 });
  }
}
