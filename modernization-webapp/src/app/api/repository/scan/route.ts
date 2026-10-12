import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { scanRepository } from "@/lib/github";
import { verify, type Session } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = verify<Session>((await cookies()).get("vm_session")?.value);
  if (!session) return NextResponse.json({ error: "Connect GitHub before scanning a repository." }, { status: 401 });
  try {
    const body = await request.json() as { repository?: string };
    const scan = await scanRepository(session.installationId, body.repository ?? session.repository ?? "");
    return NextResponse.json(scan);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Repository scan failed" }, { status: 400 });
  }
}
