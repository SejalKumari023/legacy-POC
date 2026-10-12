import { NextResponse } from "next/server";
import { assertRepositoryAccess, createPullRequest } from "@/lib/github";
import { getRun, updateRun, validWorkerToken } from "@/lib/runs";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const run = await getRun((await params).id);
  const body = await request.json() as { workerToken?: string; branch?: string; title?: string; body?: string };
  if (!run || !validWorkerToken(run, body.workerToken) || !body.branch || !body.title || !body.body) return NextResponse.json({ error: "Invalid pull request payload" }, { status: 401 });
  if (run.targets.Python === "3.12" && !run.result?.pythonValidation?.passed) return NextResponse.json({ error: "Verified Python 3.8→3.12 evidence must arrive before the PR." }, { status: 422 });
  try {
    const repository = await assertRepositoryAccess(run.installationId, run.repositoryUrl);
    const pr = await createPullRequest(run.installationId, repository, { branch: body.branch, title: body.title, body: body.body });
    await updateRun(run.id, (current) => { current.status = current.result ? "completed" : "awaiting_result"; current.branch = body.branch; current.pullRequestUrl = pr.html_url; current.events.push({ at: new Date().toISOString(), stage: "pull request", message: `PR #${pr.number} created.`, status: "passed" }); });
    return NextResponse.json(pr, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "GitHub pull request creation failed" }, { status: 400 });
  }
}
