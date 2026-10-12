# Local Claude CLI worker contract

The web app is the control plane. In the local simulation, a background Claude CLI process runs on the Mac as the controller, but it creates a fresh Daytona sandbox and performs the repository checkout, edits, validation, and branch push inside that sandbox. The browser never exposes a terminal, a work order, or a credential. The app never gives Claude a GitHub App private key.

The POC tests whether an LLM can transform legacy code with a scoped, reviewable diff and honest verification evidence. Its first demonstrated case is a Maven Java 8 to Java 21 migration; this example does not restrict the research question or establish support for other language/version paths.

## One-time setup

1. Create a GitHub App and install it only on repositories the app may modernize.
2. Set the GitHub App setup URL to `http://localhost:3000/api/auth/github/callback` for local testing.
3. Give the App `Contents: Read and write` and `Pull requests: Read and write`. The controller redeems a short-lived installation token only for its active run, passes it to Daytona only as an ephemeral command environment value, and the app creates the PR.
4. Copy `.env.example` to `.env.local` and set `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY`, and a random `APP_SESSION_SECRET`.
5. Run `npm run dev` in `modernization-webapp` and complete the GitHub installation flow in the browser.

## Per-run handoff

After the user chooses scope and target, the app creates a run and writes a mode-`0600` private work-order file for the background worker. It contains:

- `repository`: repository URL
- `runId`: opaque run identifier
- `workerToken`: capability limited to reporting one run
- `events`: endpoint for progress and failures, called by the local Claude controller
- `credentials`: endpoint for a short-lived GitHub installation token, called by the local Claude controller with the worker token in `x-worker-token`
- `createPullRequest`: endpoint that creates the real PR with the GitHub App
- `result`: endpoint for the final functional and technical change summaries shown in the app

The local launcher passes this to `claude -p` without opening Terminal. Do not commit it, log it publicly, or add it to the PR body.

Suggested prompt:

```text
Use the codebase-modernization-pr skill. Work only on this run:
<PASTE THE WORK ORDER JSON>

Create a fresh Daytona sandbox first. Redeem the short-lived credential from `credentials` on this Mac, then clone the repository inside Daytona using that credential without persisting it in remote URLs, Git config, logs, or files. Follow the requested scope and targets. Before edits, POST a `running` baseline event to `events`; after every material gate, POST an event with stage, message, and pending/running/passed/failed status. Do not create the PR yourself.

After the clean final build/tests pass, push the branch from Daytona with the short-lived credential. POST the branch, PR title, and PR body to `createPullRequest` with the worker token. Do not include generated HTML, reports, build output, credentials, or the work-order token in Git.

Then POST concise `functionalChanges`, `technicalChanges`, `verification`, and `limitations` string arrays to `result`. The app marks a run complete only after it has both the PR and this result payload.
```

## Example callback payloads: Maven Java 8 to Java 21 case study

Progress callback:

```json
{
  "workerToken": "<workerToken>",
  "runStatus": "running",
  "event": {
    "stage": "baseline",
    "message": "mvn -q test passed: 2 tests, 0 failures",
    "status": "passed"
  }
}
```

PR callback:

```json
{
  "workerToken": "<workerToken>",
  "branch": "modernize/java-8-to-21",
  "title": "Migrate Java 8 to Java 21",
  "body": "## Verification\n- Baseline: `mvn -q test` passed\n- Final: `mvn clean test` passed"
}
```

Result callback:

```json
{
  "workerToken": "<workerToken>",
  "functionalChanges": ["Existing banking flows retain their behavior."],
  "technicalChanges": ["Maven compiler release changed from 8 to 21."],
  "verification": ["mvn clean test passed"],
  "limitations": ["A JDK newer than 21 is not proof of Java 21 runtime deployment."]
}
```

The app creates the PR against the repository default branch and streams the worker events to the browser with Server-Sent Events.

## Production runner boundary

The local launcher is a simulation adapter only. In production, replace it with a queue-backed runner that creates a Daytona sandbox from a prepared snapshot, injects the one-run GitHub credential and Claude authentication only as short-lived process environment values, then runs Claude **inside** that sandbox. Stream normalized milestone events back to the same callbacks, revoke credentials, and delete the sandbox when the run reaches a terminal state. The browser contract and the GitHub App endpoints do not change.
