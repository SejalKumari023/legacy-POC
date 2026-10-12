---
name: codebase-modernization-pr
description: Modernizes an authorized GitHub repository in a Daytona sandbox, from an older language/runtime version to a user-selected target. Use when a web-app user has supplied a GitHub repository, selected whole-repository or file/folder scope, requested a target version, and needs a code-only pull request plus in-app functional and technical change summaries.
---

# Codebase Modernization Pull Request

This skill is the execution worker behind a web application. It does not own the web UI or GitHub authorization flow; it consumes the authorized repository and the user's migration choices, performs a verification-first modernization in Daytona, opens a code-only PR, and returns evidence for the app to display.

The proof of concept investigates whether an LLM can transform legacy code under a scoped, evidence-based workflow. It is not defined by one language or version pair. A Maven Java 8 to Java 21 migration is an initial case study, not the product boundary or proof that other paths work. State which language/version paths have actually been verified; do not present detection alone as migration capability or a passing build as proof of behavior preservation.

## Product contract

Required inputs from the app:

- Authorized GitHub repository URL and default branch.
- The GitHub authorization context granted by the user; never ask the user to paste a token.
- Detected languages and versions, confirmed or corrected by the user.
- Scope: the whole repository, or an explicit list of repository-relative files and folders.
- Source and target version for each selected language/runtime. `Latest` must resolve to a concrete version before work starts.

The only remote code change this skill may create is a branch and pull request in the selected repository. Never push to the default branch, change repository permissions, merge a PR, or delete a sandbox without current user authorization. Stopping the sandbox created for the current authorized run after successful delivery is required cleanup; it is not permission to stop, archive, or delete any other sandbox.

## Capability discovery

1. Inspect the current Claude CLI capabilities before acting: Daytona connector/MCP/CLI, GitHub connector/CLI, terminal, filesystem, and browser control.
2. Use the authenticated GitHub authorization context supplied by the product. Prefer GitHub and Daytona connectors or CLIs; use browser control only when it is the available authenticated path.
3. Do not invent commands, endpoints, credentials, OAuth scopes, sandbox identifiers, or environment variables. Do not reveal or persist credentials.
4. Create a Daytona sandbox only after the user has authorized an actual modernization run. Record sandbox ID, runtime image, workspace path, and lifecycle settings. Configure a finite automatic stop interval as a fallback for interrupted runs.

## User-facing product flow

1. The user opens the website `https://example.com`.
2. Onboarding asks the user to paste the GitHub repository link that needs to be updated.
3. The user is sent to the GitHub authorization page and grants the app access to that codebase. Do not use a template repository and do not require the user to clone anything first.
4. After authorization, clone the selected repository into a Daytona sandbox. Inspect its tracked source and authoritative build/toolchain files, then return every detected language and its declared or inferred version to the UI. Mark an inference as an inference and show the evidence path.
5. Let the user choose either the whole codebase or specific files/folders. Let them choose `Latest` or enter a required target version. Resolve `Latest` to a precise version and show the resolved target before executing.
6. Run the requested modernization only after the user submits those choices. Create a branch from the repository's current default branch, validate the requested scope, and open a pull request containing code and necessary build/configuration changes only.
7. Do not add generated HTML, reports, screenshots, build output, or other documentation artifacts to that PR. Return the functional and technical change data to the web app, where the user views it after the PR is sent.

## Execution workflow

1. Validate the request.
   - Confirm the repository is accessible through the existing authorization and the requested paths exist in the default-branch checkout.
   - Reject unsafe or ambiguous scope such as paths outside the repository, an empty selection, or a selected generated-output directory.
   - Identify all authoritative version declarations and build/test entry points relevant to the selected languages and scope.

2. Establish a baseline in Daytona.
   - Clone the full selected repository into the sandbox and create a migration branch from the freshly fetched default branch.
   - Run the smallest relevant build/test commands before edits. Record commands, exit status, test counts when available, and actual compiler/runtime versions.
   - If the baseline fails, do not claim the migration is verified. Report the pre-existing failure and request user direction unless a safe scoped repair is explicitly part of the request.

3. Modernize with the requested boundary.
   - Change only the selected files/folders plus the minimal root-level build or toolchain files required to make the selected scope build. Explain every unavoidable out-of-scope dependency in the result before pushing.
   - Preserve application behavior. Do not rewrite healthy source merely to use new syntax.
   - Update authoritative build, wrapper, container, CI, and dependency declarations only where required by the requested target or a verified incompatibility.
   - For each selected language, verify the target using that language's authoritative toolchain and runtime contract. In the Java 8 to Java 21 case study, use the build tool's release/API contract rather than relying solely on the sandbox's default JDK; check `maven.compiler.release=21`, clean tests, and class major version 65 when classes are produced.

### Python 3.8 to 3.12 case-study gate

For this path, do not equate a changed `requires-python` declaration with a validated migration. Record actual `python3.8 --version` and `python3.12 --version` output in Daytona. Run the existing tests and deterministic behavior cases on the untouched 3.8 checkout, then run the same cases on the transformed 3.12 checkout. Compare values and exception types/messages. If either runtime, test suite, or behavior comparison is missing or failing, stop before the PR and report the limitation.

The repository's `samples/python-3.8-ledger/` fixture includes `verify_migration.py`. For a run targeting that sample, use two separate checkouts and invoke the verifier with the sample directory in each checkout and the exact paths to both Python interpreters. It prints a JSON report and exits zero only when actual runtimes, tests, and captured behavior pass. Send that exact JSON under `pythonValidation` to the app's result callback **before** calling the PR callback; the app rejects a Python 3.12 PR without it. Do not add generated reports or the verifier's output to the transformation PR. This verifier is specific to the sample; it is not evidence that every Python repository can be migrated.

Keep the sample's tests, behavior cases, and verifier unchanged in the migration branch. If a test itself is demonstrably wrong, stop and request review rather than weakening it to obtain a pass.

4. Verify and submit.
   - Run the final clean build and relevant tests in the same sandbox.
   - Compare the branch with its default-branch base. Remove generated artifacts, secrets, credentials, and unrelated changes.
   - Confirm the diff respects the selected scope, except for documented minimal build/toolchain files. If it does not, stop and ask the user to widen the scope or approve the exception.
   - Push the branch and open a PR to the repository's default branch. The PR must contain only code, tests, build/configuration, and required dependency-lock changes; it must not contain HTML reports or other generated documentation.
   - Send the complete functional, technical, verification, and limitation result to the web app. For a Python 3.8 to 3.12 run, send the passing structured verification result before requesting the PR. After both the PR and result callbacks succeed, stop only the sandbox created for this run. Record the stopped lifecycle state in the returned result.
   - If verification, push, PR creation, or result delivery fails, do not delete the sandbox. Leave it available only until its finite auto-stop interval elapses, report its ID and state, and explain the failure.
   - Never automatically delete a sandbox. Deletion, including cleanup of an old stopped sandbox, requires current user authorization.

## Return data for the web app

Return a structured result that the app can render without copying it into the PR:

```text
repository: <owner/repo>
pull_request_url: <url>
branch: <branch>
sandbox: <id, runtime image, lifecycle state>
scope: <whole repository | requested paths plus approved exceptions>
versions: <detected source versions and concrete target versions>
baseline: <commands, status, tests, notable pre-existing failures>
verification: <commands, status, tests, target/runtime proof>
functional_changes: <plain-language behavior preserved or changed>
technical_changes: <files, configuration/dependency/API changes and reasons>
limitations_and_follow_up: <deployment, CI, runtime, or manual-test work still needed>
```

Keep functional changes understandable to a non-specialist. Keep technical changes evidence-based and link each claim to an actual changed file, command result, or detected configuration.

## Completion checklist

- [ ] The user authorized the selected GitHub repository through the app.
- [ ] The repository was cloned into Daytona; no template was copied into the repository.
- [ ] The UI received detected languages, versions, supporting evidence, and concrete requested targets.
- [ ] The user selected the whole repository or explicit files/folders before migration began.
- [ ] Baseline and final verification results are recorded honestly.
- [ ] The PR targets the selected repository's default branch and contains no generated HTML/report artifacts.
- [ ] The app received functional and technical change summaries after the PR was sent.
- [ ] The sandbox created for this successful run was stopped only after the PR and result callbacks succeeded; failed runs retain a finite auto-stop fallback.
