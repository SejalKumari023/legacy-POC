"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight, Check, ChevronRight, Code2, FolderTree, GitFork,
  GitPullRequest, LoaderCircle, LockKeyhole, RefreshCcw, ShieldCheck,
  Sparkles, SquareTerminal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type Stage = "connect" | "configure" | "running" | "complete";
type Detection = { language: string; version: string; evidence: string; confidence: "declared" | "inferred" };
type RunResult = { functionalChanges: string[]; technicalChanges: string[]; verification: string[]; limitations: string[] };
type ActiveRun = { id: string; status: string; events: { stage: string; message: string; status: string }[]; pullRequestUrl?: string; noChanges?: boolean; result?: RunResult };
const runSteps = ["Clone authorized repository", "Capture baseline", "Apply target contract", "Verify clean build", "Send pull request"];

export default function Home() {
  const [stage, setStage] = useState<Stage>("connect");
  const [repo, setRepo] = useState("https://github.com/acme/ledger-api");
  const [scope, setScope] = useState<"whole" | "specific">("whole");
  const [targetMode, setTargetMode] = useState("latest");
  const [target, setTarget] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [repositoryPaths, setRepositoryPaths] = useState<string[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [scanMessage, setScanMessage] = useState("Connect GitHub to inspect the selected repository.");
  const [authPending, setAuthPending] = useState(false);
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);

  const scanConnectedRepository = async () => {
    setScanMessage("Scanning tracked build files…");
    const sessionResponse = await fetch("/api/session", { cache: "no-store" });
    const session = await sessionResponse.json();
    if (!session.connected || !session.repository) { setScanMessage("GitHub access is still being confirmed."); return false; }
    const scanResponse = await fetch("/api/repository/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repository: session.repository }) });
    const scan = await scanResponse.json();
    if (!scanResponse.ok || scan.error) { setScanMessage(scan.error ?? "Repository scan could not be completed."); return false; }
    setRepo(`https://github.com/${scan.repository.fullName}`); setDetections(scan.detections); setRepositoryPaths(scan.paths ?? []); setPicked((scan.paths ?? []).slice(0, 3)); setSelectedLanguage(scan.detections[0]?.language ?? ""); setTarget(scan.detections[0]?.language === "Java" ? "21" : scan.detections.length ? "latest" : ""); setScanMessage(`Scanned ${scan.filesInspected.join(", ") || "repository files"}.${scan.treeTruncated ? " The repository tree was truncated, so only the returned paths are selectable." : ""}`); setStage("configure");
    return true;
  };

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("connected") !== "1") return;
    void scanConnectedRepository().finally(() => window.history.replaceState({}, "", "/"));
  }, []);

  useEffect(() => {
    if (!authPending) return;
    let stopped = false;
    const resolve = async () => {
      const response = await fetch("/api/auth/github/resolve", { cache: "no-store" });
      const status = await response.json();
      if (!stopped && status.authorized) { setAuthPending(false); await scanConnectedRepository(); }
    };
    void resolve();
    const interval = window.setInterval(() => void resolve(), 2_000);
    return () => { stopped = true; window.clearInterval(interval); };
  }, [authPending]);

  useEffect(() => {
    if (!activeRun) return;
    const stream = new EventSource(`/api/runs/${activeRun.id}/stream`);
    stream.addEventListener("run", (event) => { const next = JSON.parse((event as MessageEvent).data) as ActiveRun; setActiveRun((current) => current ? { ...current, ...next } : current); if (next.status === "completed") setStage("complete"); });
    return () => stream.close();
  }, [activeRun?.id]);

  const startRun = async () => {
    const response = await fetch("/api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repositoryUrl: repo, scope: { mode: scope, paths: scope === "specific" ? picked : [] }, targets: { [selectedLanguage]: target } }) });
    const created = await response.json(); if (!response.ok) { setScanMessage(created.error ?? "Run could not be created"); return; }
    setActiveRun({ ...created, events: [] }); setStage("running");
    void fetch(`/api/runs/${created.id}/launch`, { method: "POST" });
  };
  const reset = () => { setStage("connect"); setScope("whole"); setTargetMode("latest"); setTarget(""); setSelectedLanguage(""); setDetections([]); setRepositoryPaths([]); setPicked([]); setActiveRun(null); };
  const toggle = (path: string, checked: boolean) => setPicked((current) => checked ? [...current, path] : current.filter((item) => item !== path));
  const current = stage === "connect" ? 0 : stage === "configure" ? 1 : stage === "running" ? 2 : 3;

  return <main className="min-h-screen bg-[#eef1f7] text-[#101933]">
    <div className="mx-auto grid min-h-screen max-w-[1500px] grid-cols-1 lg:grid-cols-[288px_1fr]">
      <aside className="relative overflow-hidden bg-[#111a35] px-6 py-7 text-[#eaf0ff] lg:px-7">
        <div className="pointer-events-none absolute -right-24 top-24 size-60 rounded-full border border-[#728bff]/25" />
        <div className="pointer-events-none absolute -right-10 top-36 size-36 rounded-full border border-[#728bff]/20" />
        <div className="relative flex h-full flex-col">
          <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#6d7dff] shadow-lg shadow-[#0a1028]/40"><Sparkles className="size-4" /></span><span className="text-lg font-semibold tracking-[-0.04em]">VeriModern</span></div>
          <div className="mt-14"><p className="text-[.7rem] font-medium tracking-[.18em] text-[#9eabdf]">MODERNIZATION RUN</p><p className="mt-3 max-w-48 text-[1.65rem] font-semibold leading-[1.05] tracking-[-.055em] text-white">Upgrade with a traceable path back.</p></div>
          <ol className="mt-12 space-y-1" aria-label="Modernization steps">{["Repository", "Scope & target", "Sandbox run", "Pull request"].map((label, index) => <li key={label} className="flex items-center gap-3 py-3"><span className={`grid size-6 place-items-center rounded-full text-xs ${index < current ? "bg-[#87e8c0] text-[#112033]" : index === current ? "bg-[#728bff] text-white" : "border border-[#526083] text-[#9eabdf]"}`}>{index < current ? <Check className="size-3.5" /> : index + 1}</span><span className={index === current ? "font-medium text-white" : "text-[#9eabdf]"}>{label}</span></li>)}</ol>
          <div className="mt-auto rounded-2xl border border-[#354263] bg-[#172142] p-4"><div className="flex items-center gap-2 text-sm font-medium text-white"><ShieldCheck className="size-4 text-[#87e8c0]" />Your repository stays yours</div><p className="mt-2 text-sm leading-5 text-[#aeb9de]">GitHub access is scoped to the repository you choose. Every change goes through a pull request.</p></div>
        </div>
      </aside>
      <section className="flex min-w-0 flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-12">
        <header className="flex items-center justify-between gap-4 border-b border-[#d8deec] pb-5 text-sm text-[#58627d]"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#f5b854]" />Interactive prototype</span><span className="flex items-center gap-2"><LockKeyhole className="size-3.5" />Authorized access only</span></header>
        <div className="mx-auto flex w-full max-w-5xl flex-1 items-center py-9 lg:py-12">
          {stage === "connect" && <Connect repo={repo} setRepo={setRepo} authorizationPending={authPending} connect={() => { setAuthPending(true); setScanMessage("Waiting for GitHub to grant this repository…"); const url = `/api/auth/github/start?repo=${encodeURIComponent(repo)}`; const popup = window.open(url, "verimodern-github", "popup,width=760,height=760"); if (!popup) window.location.assign(url); }} />}
          {stage === "configure" && <Configure scope={scope} setScope={setScope} target={target} setTarget={setTarget} targetMode={targetMode} setTargetMode={setTargetMode} picked={picked} toggle={toggle} run={startRun} detections={detections} selectedLanguage={selectedLanguage} setSelectedLanguage={setSelectedLanguage} paths={repositoryPaths} repositoryUrl={repo} scanMessage={scanMessage} />}
          {stage === "running" && activeRun && <div className="w-full"><Run index={Math.min(activeRun.events.filter((event) => event.status === "passed").length, runSteps.length - 1)} language={selectedLanguage} target={target} /><Card className="mx-auto mt-5 max-w-2xl border-[#7183ff] bg-[#f1f3ff]"><CardContent className="p-5"><p className="font-semibold text-[#273351]">Sandbox worker started</p><p className="mt-2 text-sm text-[#58627d]">The simulation starts the local Claude controller in the background. It creates the Daytona sandbox, keeps credentials out of the browser, and streams verified milestones here.</p></CardContent></Card></div>}
          {stage === "complete" && <Complete target={target} reset={reset} pullRequestUrl={activeRun?.pullRequestUrl} noChanges={activeRun?.noChanges} result={activeRun?.result} />}
        </div>
      </section>
    </div>
  </main>;
}

function Connect({ repo, setRepo, authorizationPending, connect }: { repo: string; setRepo: (value: string) => void; authorizationPending: boolean; connect: () => void }) {
  return <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-end"><div>
    <Badge className="rounded-full bg-[#e1e5ff] px-3 py-1 text-[#4052be] hover:bg-[#e1e5ff]">Start with the code you own</Badge>
    <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-[.98] tracking-[-.065em] sm:text-5xl">Can an LLM transform your legacy code?</h1>
    <p className="mt-5 max-w-xl text-[1.05rem] leading-7 text-[#58627d]">Connect one GitHub repository, inspect its declared versions, and choose a scoped transformation to test in a sandbox. Java 8 to 21 is one case study, not the limit of the question.</p>
    <Card className="mt-9 border-[#cfd7eb] bg-white shadow-[0_20px_55px_rgba(25,41,91,.1)]"><CardContent className="p-5 sm:p-6"><label htmlFor="repo" className="text-sm font-semibold text-[#273351]">GitHub repository link</label><div className="mt-3 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><GitFork className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#69748e]" /><Input id="repo" value={repo} onChange={(event) => setRepo(event.target.value)} disabled={authorizationPending} className="h-12 border-[#c6cee2] bg-[#f8f9fd] pl-10" /></div><Button size="lg" disabled={authorizationPending || !repo.startsWith("https://github.com/")} onClick={connect} className="h-12 bg-[#111a35] px-5 hover:bg-[#263765]">{authorizationPending ? "Waiting for GitHub…" : <>Authorize GitHub <ChevronRight className="size-4" /></>}</Button></div><p className="mt-3 text-sm leading-5 text-[#69748e]">GitHub opens in a separate window. After you grant this repository, this page detects the access and starts its scan automatically.</p></CardContent></Card>
  </div><div className="border-l-0 border-[#cfd7eb] pl-0 lg:border-l lg:pl-8"><p className="font-mono text-xs tracking-wide text-[#6d7dff]">WHAT HAPPENS NEXT</p><div className="mt-5 space-y-5"><Mini icon={<GitFork className="size-4" />} title="Authorize" copy="GitHub grants access to this repository only." /><Mini icon={<Code2 className="size-4" />} title="Inspect" copy="We read language versions from tracked build files." /><Mini icon={<FolderTree className="size-4" />} title="Decide" copy="You choose the target and the code boundary." /></div></div></div>;
}

function Mini({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) { return <div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#dfe5fb] text-[#465ad0]">{icon}</span><div><h2 className="font-semibold text-[#273351]">{title}</h2><p className="mt-.5 text-sm leading-5 text-[#69748e]">{copy}</p></div></div>; }

function Configure({ scope, setScope, target, setTarget, targetMode, setTargetMode, picked, toggle, run, detections, selectedLanguage, setSelectedLanguage, paths, repositoryUrl, scanMessage }: { scope: "whole" | "specific"; setScope: (value: "whole" | "specific") => void; target: string; setTarget: (value: string) => void; targetMode: string; setTargetMode: (value: string) => void; picked: string[]; toggle: (path: string, checked: boolean) => void; run: () => void; detections: Detection[]; selectedLanguage: string; setSelectedLanguage: (value: string) => void; paths: string[]; repositoryUrl: string; scanMessage: string }) {
  const repositoryName = repositoryUrl.replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "");
  const languageChoices = [...new Set(detections.map((item) => item.language))];
  return <div className="w-full"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><Badge className="rounded-full bg-[#dff5ed] px-3 py-1 text-[#19745b] hover:bg-[#dff5ed]">GitHub access confirmed</Badge><h1 className="mt-4 text-4xl font-semibold tracking-[-.06em] sm:text-5xl">Set the boundary.</h1><p className="mt-3 text-[1.05rem] leading-7 text-[#58627d]">Your choices become the verification contract for this pull request.</p></div><div className="rounded-xl border border-[#cbd3e7] bg-white px-4 py-3 text-sm text-[#58627d]"><b className="text-[#273351]">{repositoryName}</b><span className="mx-2 text-[#a6afc3]">/</span>default branch</div></div>
    <div className="mt-8 grid gap-5 xl:grid-cols-[.88fr_1.12fr]"><Card className="border-[#cfd7eb] bg-white shadow-[0_16px_40px_rgba(25,41,91,.06)]"><CardContent className="p-5 sm:p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold tracking-[-.03em]">Detected build files</h2><span className="font-mono text-xs text-[#69748e]">{detections.length} manifests</span></div><Separator className="my-5 bg-[#e1e6f2]" /><div className="max-h-72 space-y-4 overflow-y-auto pr-1">{detections.map((item, index) => <div key={`${item.language}-${item.evidence}`} className="flex items-center gap-3"><span className={`size-2 rounded-full ${["bg-orange-500", "bg-sky-500", "bg-amber-400"][index % 3]}`} /><div className="min-w-0 flex-1"><p className="font-medium text-[#273351]">{item.language}</p><p className="truncate font-mono text-xs text-[#69748e]" title={item.evidence}>{item.evidence} · {item.confidence}</p></div><Badge variant="outline" className="shrink-0 border-[#cfd7eb] font-mono text-[#4e5b79]">{item.version}</Badge></div>)}</div><p className="mt-6 rounded-xl bg-[#eff2ff] p-4 text-sm leading-5 text-[#425196]">{scanMessage}</p></CardContent></Card>
      <div className="space-y-5"><Card className="border-[#cfd7eb] bg-white shadow-[0_16px_40px_rgba(25,41,91,.06)]"><CardContent className="p-5 sm:p-6"><h2 className="text-lg font-semibold tracking-[-.03em]">What should change?</h2><div className="mt-4 grid gap-3"><button type="button" onClick={() => setScope("whole")} className={`rounded-xl border p-4 text-left transition-colors ${scope === "whole" ? "border-[#7183ff] bg-[#f1f3ff]" : "border-[#d8deec]"}`}><b className="block text-[#273351]">Whole codebase</b><span className="mt-1 block text-sm leading-5 text-[#69748e]">Modernize every related build, source, test, and CI file.</span></button><button type="button" onClick={() => setScope("specific")} className={`rounded-xl border p-4 text-left transition-colors ${scope === "specific" ? "border-[#7183ff] bg-[#f1f3ff]" : "border-[#d8deec]"}`}><b className="block text-[#273351]">Specific files or folders</b><span className="mt-1 block text-sm leading-5 text-[#69748e]">Keep the pull request limited to the paths you select.</span></button></div>{scope === "specific" && <div className="mt-4 grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-dashed border-[#bac4e0] bg-[#fbfcff] p-3 sm:grid-cols-2">{paths.map((path) => <label key={path} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[#3c4865] hover:bg-[#eef1fb]"><Checkbox checked={picked.includes(path)} onCheckedChange={(checked) => toggle(path, checked === true)} /><span className="font-mono text-xs">{path}</span></label>)}</div>}</CardContent></Card>
      <Card className="border-[#cfd7eb] bg-white shadow-[0_16px_40px_rgba(25,41,91,.06)]"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:p-6"><div className="flex-1"><label className="text-lg font-semibold tracking-[-.03em]">Language and target</label><p className="mt-1 text-sm text-[#69748e]">Each build file keeps its own detected version. A concrete target is required before launch.</p><Select value={selectedLanguage} onValueChange={(value) => { if (!value) return; setSelectedLanguage(value); if (targetMode === "latest") setTarget(value === "Java" ? "21" : "latest"); }}><SelectTrigger className="mt-4 h-11 w-full border-[#c6cee2] bg-[#f8f9fd]"><SelectValue /></SelectTrigger><SelectContent>{languageChoices.map((language) => <SelectItem key={language} value={language}>{language} · {detections.filter((item) => item.language === language).length} detected file{detections.filter((item) => item.language === language).length === 1 ? "" : "s"}</SelectItem>)}</SelectContent></Select><Select value={targetMode} onValueChange={(value) => { if (!value) return; setTargetMode(value); if (value === "latest") setTarget(selectedLanguage === "Java" ? "21" : "latest"); }}><SelectTrigger className="mt-3 h-11 w-full border-[#c6cee2] bg-[#f8f9fd]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="latest">Latest supported target</SelectItem><SelectItem value="required">Enter a required version</SelectItem></SelectContent></Select></div><div className="w-full sm:w-40"><label htmlFor="target" className="text-sm font-medium text-[#58627d]">Resolved target</label><Input id="target" value={target} onChange={(event) => setTarget(event.target.value)} disabled={targetMode === "latest"} className="mt-2 h-11 border-[#c6cee2] bg-[#f8f9fd] font-mono disabled:opacity-100" /></div><Button onClick={run} disabled={!selectedLanguage || !target || target === "latest" || (scope === "specific" && picked.length === 0)} className="h-11 bg-[#6d7dff] px-5 hover:bg-[#5266e8]">Run in sandbox <SquareTerminal className="size-4" /></Button></CardContent></Card></div>
    </div></div>;
}

function Run({ index, language, target }: { index: number; language: string; target: string }) {
  const done = index >= runSteps.length;
  return <div className="mx-auto w-full max-w-2xl"><div className="text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#111a35] text-[#b9c4ff] shadow-xl shadow-[#111a35]/15">{done ? <Check className="size-7 text-[#87e8c0]" /> : <LoaderCircle className="size-7 animate-spin" />}</div><h1 className="mt-6 text-4xl font-semibold tracking-[-.06em]">Working in Daytona.</h1><p className="mt-3 text-[1.05rem] text-[#58627d]">A clean sandbox is verifying the {language} target {target}.</p></div><Card className="mt-8 overflow-hidden border-[#cfd7eb] bg-white shadow-[0_20px_55px_rgba(25,41,91,.1)]"><CardContent className="p-0"><div className="flex items-center justify-between bg-[#111a35] px-5 py-4 font-mono text-xs text-[#d8e0ff]"><span>daytona / provisioned workspace</span><span className="flex items-center gap-2"><span className="size-2 animate-pulse rounded-full bg-[#87e8c0]" />running</span></div><div className="p-5 sm:p-7"><Progress value={(index / runSteps.length) * 100} className="h-2 bg-[#e6eaf4] [&>div]:bg-[#6d7dff]" /><ol className="mt-6 space-y-4">{runSteps.map((step, position) => <li key={step} className="flex items-center gap-3"><span className={`grid size-6 place-items-center rounded-full ${position < index ? "bg-[#dff5ed] text-[#187254]" : position === index && !done ? "bg-[#e1e5ff] text-[#5266e8]" : "bg-[#edf0f6] text-[#9ba5bb]"}`}>{position < index ? <Check className="size-3.5" /> : position === index && !done ? <LoaderCircle className="size-3.5 animate-spin" /> : <span className="text-xs">{position + 1}</span>}</span><span className={position <= index ? "font-medium text-[#273351]" : "text-[#8490a9]"}>{step}</span>{position < index && <span className="ml-auto font-mono text-xs text-[#19805f]">passed</span>}</li>)}</ol></div></CardContent></Card><p className="mt-4 text-center text-sm text-[#69748e]">Live events are emitted by the background worker; credentials are never shown in the browser.</p></div>;
}

function Complete({ target, reset, pullRequestUrl, noChanges, result }: { target: string; reset: () => void; pullRequestUrl?: string; noChanges?: boolean; result?: RunResult }) {
  const functional = result?.functionalChanges ?? ["The worker did not return a functional summary."];
  const technical = result?.technicalChanges ?? ["The worker did not return a technical summary."];
  const verification = result?.verification ?? [];
  const limitations = result?.limitations ?? [];
  return <div className="w-full"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><Badge className="rounded-full bg-[#dff5ed] px-3 py-1 text-[#187254] hover:bg-[#dff5ed]"><Check className="mr-1 size-3.5" />{noChanges ? "Already at target" : "Pull request sent"}</Badge><h1 className="mt-4 text-4xl font-semibold tracking-[-.06em] sm:text-5xl">{noChanges ? "No update needed." : "Ready for review."}</h1><p className="mt-3 text-[1.05rem] leading-7 text-[#58627d]">The target contract now resolves to {target}; the worker’s evidence is recorded below.</p></div><Button variant="outline" onClick={reset} className="border-[#bcc6df] bg-white text-[#34405f] hover:bg-[#f4f6fb]"><RefreshCcw className="size-4" />Start another run</Button></div><div className="mt-8 grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><Card className="border-[#5f72f2] bg-[#111a35] text-white shadow-[0_20px_55px_rgba(25,41,91,.16)]"><CardContent className="p-6"><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl bg-[#273765] text-[#b9c4ff]"><GitPullRequest className="size-5" /></span><Badge className="bg-[#24345f] text-[#cbd4ff] hover:bg-[#24345f]">{noChanges ? "no diff" : "code only"}</Badge></div><p className="mt-7 font-mono text-xs text-[#aeb9de]">authorized repository · default branch</p><h2 className="mt-2 text-xl font-semibold tracking-[-.04em]">{noChanges ? "Repository already meets target" : "Modernization pull request"}</h2><p className="mt-3 text-sm leading-6 text-[#b9c4dc]">{noChanges ? "The worker verified the requested state and intentionally created no empty pull request." : "The app creates the GitHub pull request after the sandbox worker pushes its branch."}</p>{pullRequestUrl ? <a href={pullRequestUrl} target="_blank" rel="noreferrer" className="mt-6 flex items-center gap-2 text-sm font-medium text-[#aeb9ff]">Open pull request <ArrowUpRight className="size-4" /></a> : null}<Separator className="my-5 bg-[#394a79]" /><p className="text-sm leading-5 text-[#aeb9de]">Reports and HTML are not included in the pull request. Review evidence stays here in the app.</p></CardContent></Card><div className="grid gap-5 sm:grid-cols-2"><Card className="border-[#cfd7eb] bg-white shadow-[0_16px_40px_rgba(25,41,91,.06)]"><CardContent className="p-6"><p className="font-mono text-xs tracking-wide text-[#5165d2]">FUNCTIONAL CHANGE</p><h2 className="mt-3 text-xl font-semibold tracking-[-.04em] text-[#273351]">What users can expect</h2><ul className="mt-3 space-y-2 text-sm leading-6 text-[#69748e]">{functional.map((item) => <li key={item} className="flex gap-2"><Check className="mt-1 size-3.5 shrink-0 text-[#19805f]" />{item}</li>)}</ul></CardContent></Card><Card className="border-[#cfd7eb] bg-white shadow-[0_16px_40px_rgba(25,41,91,.06)]"><CardContent className="p-6"><p className="font-mono text-xs tracking-wide text-[#5165d2]">TECHNICAL CHANGE</p><h2 className="mt-3 text-xl font-semibold tracking-[-.04em] text-[#273351]">Implementation record</h2><ul className="mt-3 space-y-2 text-sm leading-6 text-[#69748e]">{technical.map((item) => <li key={item} className="flex gap-2"><Code2 className="mt-1 size-3.5 shrink-0 text-[#5165d2]" />{item}</li>)}</ul>{verification.length > 0 && <div className="mt-4 border-t border-[#e1e6f2] pt-3"><p className="font-mono text-[.65rem] tracking-wide text-[#5165d2]">VERIFICATION</p><ul className="mt-2 space-y-1 text-xs leading-5 text-[#69748e]">{verification.map((item) => <li key={item}>• {item}</li>)}</ul></div>}{limitations.length > 0 && <div className="mt-4 rounded-lg bg-[#fff8e7] p-3 text-xs leading-5 text-[#765619]">{limitations.join(" ")}</div>}</CardContent></Card></div></div></div>;
}
