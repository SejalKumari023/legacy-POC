#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const path = process.argv[2];
if (!path) throw new Error("Usage: node scripts/run-claude-work-order.mjs <work-order.json>");
const workOrder = JSON.parse(await readFile(path, "utf8"));
const pythonCase = workOrder.targets?.Python === "3.12";
const pythonInstructions = pythonCase ? `

Python 3.8→3.12 verification gate: confirm the source actually runs on Python 3.8. For the samples/python-3.8-ledger case study, keep separate baseline and candidate checkouts in Daytona. Use actual Python 3.8 and 3.12 executables to run samples/python-3.8-ledger/verify_migration.py with --baseline-dir, --candidate-dir, --python38, and --python312. The verifier must exit 0 and report passed:true. Do not fabricate or paraphrase this JSON. POST the parsed report under pythonValidation to resultEndpoint BEFORE asking pullRequestEndpoint to open a PR. The server rejects a Python PR without it. If the project is not this sample, use equivalent deterministic baseline/target tests and behavior cases, but do not claim the sample verifier covers an arbitrary repository; report the unsupported verification path and do not open a PR unless an equivalent structured report can honestly be supplied.` : "";
const prompt = `Use the codebase-modernization-pr skill for this work order. This POC tests whether an LLM can transform legacy code under a scoped verification workflow; do not assume any particular language or target version. You are the local Mac controller: discover the available Daytona capability, create a fresh sandbox, and clone the repository inside that sandbox—not on the Mac.

Work order: ${JSON.stringify(workOrder, null, 2)}

Use curl from this Mac with x-worker-token to redeem the short-lived credential at credentialEndpoint. Pass it into Daytona only as an ephemeral command environment value. Never write it to Git configuration, the repository, logs, a PR, or documentation.

Inside Daytona: clone repositoryUrl, branch from its default branch, obey scope and targets, run baseline tests, modernize, run final verification, and push the branch. POST concise status events to eventEndpoint throughout. Do not create a PR directly. For a Python 3.12 target, POST the result with machine-readable pythonValidation before requesting a PR; for other targets, preserve the existing callback order. If a real code diff is needed, push and POST branch/title/body to pullRequestEndpoint. POST functionalChanges, technicalChanges, verification, and limitations arrays to resultEndpoint. If the requested target is already satisfied and there is no code diff, do not create an empty branch or PR; include noChanges: true in the result payload instead. The app completes only after it receives either a PR plus result or a no-change result.${pythonInstructions}`;
// This is intentionally headless: the browser only receives signed progress events,
// never a Terminal window, credential, or reusable work order capability.
const child = spawn("claude", ["-p", prompt], {
  cwd: resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
  detached: true,
  stdio: "ignore",
  windowsHide: true,
});
child.unref();
