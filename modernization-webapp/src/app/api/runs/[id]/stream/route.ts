import { cookies } from "next/headers";
import { getRun } from "@/lib/runs";
import { verify, type Session } from "@/lib/session";

export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const runId = (await params).id;
  const session = verify<Session>((await cookies()).get("vm_session")?.value);
  const initial = await getRun(runId);
  if (!session || !initial || initial.installationId !== session.installationId) return new Response("Run not found", { status: 404 });
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    async start(controller) {
      let revision = "";
      const send = async () => {
        const run = await getRun(runId);
        if (!run) return;
        const { workerToken, ...safe } = run;
        const next = JSON.stringify(safe);
        if (next !== revision) { revision = next; controller.enqueue(encoder.encode(`event: run\ndata: ${next}\n\n`)); }
        if (run.status === "completed" || run.status === "failed") { if (timer) clearInterval(timer); controller.close(); }
      };
      await send(); timer = setInterval(() => { void send(); }, 1000);
      request.signal.addEventListener("abort", () => { if (timer) clearInterval(timer); controller.close(); });
    },
    cancel() { if (timer) clearInterval(timer); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
