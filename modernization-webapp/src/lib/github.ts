import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

export type RepositoryRef = { owner: string; name: string; fullName: string; defaultBranch: string };
export type Detection = { language: string; version: string; evidence: string; confidence: "declared" | "inferred" };

const api = "https://api.github.com";
const headers = (token: string) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "User-Agent": "verimodern-local-control-plane",
  "X-GitHub-Api-Version": "2022-11-28",
});

export function parseRepositoryUrl(value: string) {
  const url = new URL(value);
  if (url.hostname !== "github.com") throw new Error("Use a github.com repository URL");
  const [owner, rawName] = url.pathname.split("/").filter(Boolean);
  const name = rawName?.replace(/\.git$/, "");
  if (!owner || !name) throw new Error("Repository URL must include an owner and repository name");
  return { owner, name, fullName: `${owner}/${name}` };
}

export function appJwt() {
  const appId = process.env.GITHUB_APP_ID;
  const configuredPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const privateKey = configuredPrivateKey || (process.env.GITHUB_APP_PRIVATE_KEY_PATH ? readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH, "utf8") : undefined);
  if (!appId || !privateKey) throw new Error("GitHub App credentials are not configured");
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const body = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iat: now - 60, exp: now + 540, iss: appId })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(body); signer.end();
  return `${body}.${signer.sign(privateKey).toString("base64url")}`;
}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${api}${path}`, { ...init, headers: { ...headers(token), ...init?.headers }, cache: "no-store" });
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

export async function installationToken(installationId: number) {
  const response = await request<{ token: string }>(`/app/installations/${installationId}/access_tokens`, appJwt(), { method: "POST" });
  return response.token;
}

export async function installationForRepository(repositoryUrl: string) {
  const parsed = parseRepositoryUrl(repositoryUrl);
  const installation = await request<{ id: number }>(`/repos/${parsed.owner}/${parsed.name}/installation`, appJwt());
  return installation.id;
}

export async function assertRepositoryAccess(installationId: number, repositoryUrl: string): Promise<RepositoryRef> {
  const parsed = parseRepositoryUrl(repositoryUrl);
  const token = await installationToken(installationId);
  const repo = await request<{ full_name: string; default_branch: string }>(`/repos/${parsed.owner}/${parsed.name}`, token);
  return { ...parsed, fullName: repo.full_name, defaultBranch: repo.default_branch };
}

async function fileText(ref: RepositoryRef, token: string, path: string) {
  try {
    const file = await request<{ content?: string; encoding?: string }>(`/repos/${ref.owner}/${ref.name}/contents/${path}?ref=${encodeURIComponent(ref.defaultBranch)}`, token);
    return file.encoding === "base64" && file.content ? Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8") : "";
  } catch { return ""; }
}

export async function scanRepository(installationId: number, repositoryUrl: string) {
  const ref = await assertRepositoryAccess(installationId, repositoryUrl);
  const token = await installationToken(installationId);
  const tree = await request<{ tree: Array<{ path: string; type: "blob" | "tree" }>; truncated: boolean }>(`/repos/${ref.owner}/${ref.name}/git/trees/${encodeURIComponent(ref.defaultBranch)}?recursive=1`, token);
  const manifestNames = new Set(["pom.xml", "package.json", "pyproject.toml", "requirements.txt", "go.mod", ".nvmrc", ".tool-versions"]);
  const candidates = tree.tree
    .filter((entry) => entry.type === "blob" && manifestNames.has(entry.path.split("/").at(-1) ?? ""))
    .map((entry) => entry.path)
    .sort()
    .slice(0, 40);
  const content = Object.fromEntries(await Promise.all(candidates.map(async (path) => [path, await fileText(ref, token, path)])));
  const detections: Detection[] = [];
  const record = (language: string, version: string, evidence: string, confidence: Detection["confidence"]) => {
    detections.push({ language, version, evidence, confidence });
  };
  for (const [path, text] of Object.entries(content) as Array<[string, string]>) {
    const name = path.split("/").at(-1);
    if (name === "pom.xml") {
      const release = text.match(/<maven\.compiler\.release>([^<]+)<\/maven\.compiler\.release>/)
        ?? text.match(/<release>([^<]+)<\/release>/)
        ?? text.match(/<java\.version>([^<]+)<\/java\.version>/)
        ?? text.match(/<maven\.compiler\.(?:source|target)>([^<]+)<\/maven\.compiler\.(?:source|target)>/);
      const version = release?.[1] ?? "unresolved";
      record("Java", version, path, release ? "declared" : "inferred");
    }
    if (name === "package.json") {
      const engines = text.match(/"node"\s*:\s*"([^"]+)"/);
      record("JavaScript/TypeScript", engines?.[1] ?? "unresolved", path, engines ? "declared" : "inferred");
    }
    if (name === "pyproject.toml" || name === "requirements.txt") {
      const python = text.match(/requires-python\s*=\s*"([^"]+)"/);
      record("Python", python?.[1] ?? "unresolved", path, python ? "declared" : "inferred");
    }
    if (name === "go.mod") {
      const go = text.match(/^go\s+(.+)$/m);
      record("Go", go?.[1] ?? "unresolved", path, go ? "declared" : "inferred");
    }
  }
  const paths = tree.tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => entry.path)
    .filter((entry) => !entry.startsWith("node_modules/") && !entry.startsWith("target/") && !entry.startsWith(".git/"))
    .slice(0, 500);
  return { repository: ref, detections, filesInspected: candidates.filter((path) => content[path]), paths, treeTruncated: tree.truncated };
}

export async function createPullRequest(installationId: number, ref: RepositoryRef, input: { branch: string; title: string; body: string }) {
  const token = await installationToken(installationId);
  return request<{ html_url: string; number: number }>(`/repos/${ref.owner}/${ref.name}/pulls`, token, { method: "POST", body: JSON.stringify({ head: input.branch, base: ref.defaultBranch, title: input.title, body: input.body }) });
}
