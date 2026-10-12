import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verify, type Session } from "@/lib/session";

export async function GET() {
  const store = await cookies();
  const session = verify<Session>(store.get("vm_session")?.value);
  return NextResponse.json({ connected: Boolean(session), repository: session?.repository ?? null });
}
