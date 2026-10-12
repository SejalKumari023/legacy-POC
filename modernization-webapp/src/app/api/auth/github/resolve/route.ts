import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertRepositoryAccess, installationForRepository } from "@/lib/github";
import { sign, verify, type Session } from "@/lib/session";

export const runtime = "nodejs";
type ConnectionAttempt = { repository: string; exp: number };

export async function GET() {
  const store = await cookies();
  const attempt = verify<ConnectionAttempt>(store.get("vm_connect")?.value);
  if (!attempt || attempt.exp < Date.now()) return NextResponse.json({ authorized: false });

  const session = verify<Session>(store.get("vm_session")?.value);
  if (session?.repository === attempt.repository) return NextResponse.json({ authorized: true, repository: session.repository });

  try {
    const installationId = await installationForRepository(attempt.repository);
    const repository = await assertRepositoryAccess(installationId, attempt.repository);
    const resolved = `https://github.com/${repository.fullName}`;
    store.set("vm_session", sign({ installationId, repository: resolved } satisfies Session), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 8, path: "/" });
    store.delete("vm_connect");
    return NextResponse.json({ authorized: true, repository: resolved });
  } catch {
    return NextResponse.json({ authorized: false });
  }
}
