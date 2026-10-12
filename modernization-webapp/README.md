# VeriModern

VeriModern is a proof of concept investigating whether an LLM can transform legacy code through a scoped, reviewable, verification-first workflow. A Maven Java 8 to Java 21 migration is an initial case study, not the scope of the research question or evidence that every language path is supported.

The local simulation runs at `http://localhost:3000`. A user authorizes a GitHub repository, reviews detected language/version declarations, chooses a target and file scope, and starts a background Claude CLI controller. The controller performs checkout and modernization inside Daytona; the app receives progress, creates a code-only pull request, and displays functional and technical summaries. This is a prototype, not a production harness.

Detection is broader than validated transformation: the scanner recognizes selected Java, Node, Python, and Go manifests, while end-to-end migration evidence currently comes from the Maven Java example. A passing build and tests do not alone prove behavior preservation. Automatic characterization-test generation, behavioral comparison, and validated adapters for additional language paths remain planned work.

For local setup and the worker callback contract, see [Local Claude CLI worker contract](docs/local-claude-worker.md). Start the web app with `npm run dev` after configuring the required local environment.
