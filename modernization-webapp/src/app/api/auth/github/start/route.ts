import { NextResponse } from "next/server";
import { parseRepositoryUrl } from "@/lib/github";
import { sign } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const repository = requestUrl(request).searchParams.get("repo") ?? "";
    parseRepositoryUrl(repository);
    const slug = process.env.GITHUB_APP_SLUG;
    if (!slug) throw new Error("GITHUB_APP_SLUG is not configured");
    const state = sign({ repository, exp: Date.now() + 10 * 60_000 });
    const response = NextResponse.redirect(`https://github.com/apps/${slug}/installations/new?state=${encodeURIComponent(state)}`);
    response.cookies.set("vm_connect", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 10 * 60, path: "/" });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "GitHub authorization could not start" }, { status: 400 });
  }
}
function requestUrl(request: Request) { return new URL(request.url); }
