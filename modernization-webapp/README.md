# VeriModern

VeriModern is a proof of concept investigating whether an LLM can transform legacy code through a scoped, reviewable, verification-first workflow. A Maven Java 8 to Java 21 migration is an initial case study, not the scope of the research question or evidence that every language path is supported.

The local simulation runs at `http://localhost:3000`. A user authorizes a GitHub repository, reviews detected language/version declarations, chooses a target and file scope, and starts a background Claude CLI controller. The controller performs checkout and modernization inside Daytona; the app receives progress, creates a code-only pull request, and displays functional and technical summaries. This is a prototype, not a production harness.

Detection is broader than validated transformation: the scanner recognizes selected Java, Node, Python, and Go manifests. The Maven Java example has an end-to-end migration history. A second, deliberately narrow Python 3.8→3.12 sample now has a deterministic verifier that checks both actual runtimes, tests, declared versions, and six output/exception cases. The app requires that report before opening a Python 3.12 PR. This does not yet prove an end-to-end Claude/Daytona PR for Python or general support for arbitrary Python projects. Automatic characterization-test generation remains future work.

For local setup and the worker callback contract, see [Local Claude CLI worker contract](docs/local-claude-worker.md). Start the web app with `npm run dev` after configuring the required local environment.
