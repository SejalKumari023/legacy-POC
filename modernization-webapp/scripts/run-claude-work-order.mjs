#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const path = process.argv[2];
if (!path) throw new Error("Usage: node scripts/run-claude-work-order.mjs <work-order.json>");
const workOrder = JSON.parse(await readFile(path, "utf8"));
const prompt = `Use the codebase-modernization-pr skill for this work order. This POC tests whether an LLM can transform legacy code under a scoped verification workflow; do not assume any particular language or target version. You are the local Mac controller: discover the available Daytona capability, create a fresh sandbox, and clone the repository inside that sandbox—not on the Mac.

Work order: ${JSON.stringify(workOrder, null, 2)}

Use curl from this Mac with x-worker-token to redeem the short-lived credential at credentialEndpoint. Pass it into Daytona only as an ephemeral command environment value. Never write it to Git configuration, the repository, logs, a PR, or documentation.

Inside Daytona: clone repositoryUrl, branch from its default branch, obey scope and targets, run baseline tests, modernize, run final verification, and push the branch. POST concise status events to eventEndpoint throughout. Do not create a PR directly. If a real code diff is needed, push and POST branch/title/body to pullRequestEndpoint. POST functionalChanges, technicalChanges, verification, and limitations arrays to resultEndpoint. If the requested target is already satisfied and there is no code diff, do not create an empty branch or PR; include noChanges: true in the result payload instead. The app completes only after it receives either a PR plus result or a no-change result.`;
// This is intentionally headless: the browser only receives signed progress events,
// never a Terminal window, credential, or reusable work order capability.
const child = spawn("claude", ["-p", prompt], {
  detached: true,
  stdio: "ignore",
  windowsHide: true,
});
child.unref();
