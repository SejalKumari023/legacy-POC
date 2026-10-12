import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertRepositoryAccess } from "@/lib/github";
import { sign, verify, type Session } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const installationId = Number(url.searchParams.get("installation_id"));
  const store = await cookies();
  const state = verify<{ repository: string; exp: number }>(url.searchParams.get("state") ?? undefined) ?? verify<{ repository: string; exp: number }>(store.get("vm_connect")?.value);
  if (!installationId || !state || state.exp < Date.now()) return NextResponse.json({ error: "The GitHub authorization link is invalid or expired." }, { status: 400 });
  try {
    const repository = await assertRepositoryAccess(installationId, state.repository);
    const session: Session = { installationId, repository: `https://github.com/${repository.fullName}` };
    store.set("vm_session", sign(session), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 8, path: "/" });
    store.delete("vm_connect");
    return NextResponse.redirect(new URL("/?connected=1", url));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "GitHub installation could not access this repository." }, { status: 403 });
  }
}
