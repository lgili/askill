import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { listAdapters, resolveAdapterState } from "./adapters.js";
import { buildRawGitHubUrl } from "./catalog.js";
import { getScopedStatePaths } from "./config.js";
import { readJson, readText } from "./fs.js";
import { fetchText } from "./http.js";
import {
  addProjectSource,
  getInstalledSkills,
  installSkills,
  listProjectSources,
  loadProjectCatalogs,
  removeProjectSource,
  removeSkills,
  syncInstalledSkills,
  updateInstalledSkills,
} from "./install.js";
import { renderMarkdownToHtml } from "./markdown.js";
import type {
  CatalogLoader,
  InstalledSkillMetadata,
  LockfileState,
  ProjectOptions,
  SkillDownloader,
  SourcedSkillManifest,
  SyncWriteMode,
} from "./types.js";
import { CliError } from "./types.js";

type BrowserOpener = (url: string) => Promise<void>;
type SkillBodyLoader = (skill: SourcedSkillManifest, context: { options: ProjectOptions }) => Promise<string>;
type RequestScope = "local" | "global";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const UI_BOOTSTRAP_MARKER = "\"__SKILLEX_BOOTSTRAP__\"";

export interface WebUiServerOptions extends ProjectOptions {
  host?: string | undefined;
  port?: number | undefined;
  autoOpen?: boolean | undefined;
  openBrowser?: BrowserOpener | undefined;
  catalogLoader?: CatalogLoader | undefined;
  downloader?: SkillDownloader | undefined;
  skillBodyLoader?: SkillBodyLoader | undefined;
}

export interface WebUiSession {
  url: string;
  opened: boolean;
  close: () => Promise<void>;
}

interface DashboardState {
  scope: RequestScope;
  cwd: string;
  stateDir: string;
  initialized: boolean;
  sources: Awaited<ReturnType<typeof listProjectSources>>;
  installed: Array<{ id: string } & InstalledSkillMetadata>;
  adapters: {
    active: string | null;
    detected: string[];
    supported: ReturnType<typeof listAdapters>;
  };
  settings: {
    autoSync: boolean;
  };
  sync: LockfileState["sync"];
  syncHistory: LockfileState["syncHistory"];
}

interface CatalogResponse {
  formatVersion: number;
  sources: Array<{ repo: string; ref: string; label?: string | undefined; skillCount: number }>;
  skills: Array<SourcedSkillManifest & { installed: boolean }>;
}

interface SkillDetailResponse {
  skill: SourcedSkillManifest & { installed: boolean };
  instructionsMarkdown: string;
  instructionsHtml: string;
  instructionsError: string | null;
}

interface WebUiBootstrap {
  token: string;
  initialScope: RequestScope;
  initialSkillId: string | null;
}

interface StaticAsset {
  body: Buffer;
  contentType: string;
}

function toProjectOptions(options: WebUiServerOptions): ProjectOptions {
  const projectOptions: ProjectOptions = {
    cwd: options.cwd || process.cwd(),
    scope: options.scope,
  };

  if (options.repo) projectOptions.repo = options.repo;
  if (options.ref) projectOptions.ref = options.ref;
  if (options.catalogPath) projectOptions.catalogPath = options.catalogPath;
  if (options.skillsDir) projectOptions.skillsDir = options.skillsDir;
  if (options.catalogUrl !== undefined) projectOptions.catalogUrl = options.catalogUrl;
  if (options.cacheDir) projectOptions.cacheDir = options.cacheDir;
  if (options.noCache !== undefined) projectOptions.noCache = options.noCache;
  if (options.agentSkillsDir) projectOptions.agentSkillsDir = options.agentSkillsDir;
  if (options.adapter) projectOptions.adapter = options.adapter;
  if (options.autoSync !== undefined) projectOptions.autoSync = options.autoSync;
  if (options.dryRun !== undefined) projectOptions.dryRun = options.dryRun;
  if (options.mode) projectOptions.mode = options.mode;
  if (options.trust !== undefined) projectOptions.trust = options.trust;
  if (options.yes !== undefined) projectOptions.yes = options.yes;
  if (options.timeout !== undefined) projectOptions.timeout = options.timeout;
  if (options.now) projectOptions.now = options.now;
  if (options.verbose !== undefined) projectOptions.verbose = options.verbose;
  if (options.onProgress) projectOptions.onProgress = options.onProgress;

  return projectOptions;
}

function readRequestedScope(value: string | undefined | null): RequestScope {
  return value === "global" ? "global" : "local";
}

function withRequestScope<T extends ProjectOptions>(options: T, scopeValue: string | undefined | null): T {
  return {
    ...options,
    scope: readRequestedScope(scopeValue),
  };
}

/**
 * Starts a loopback-only local Web UI server for Skillex and optionally opens the browser.
 */
export async function startWebUiServer(options: WebUiServerOptions = {}): Promise<WebUiSession> {
  const host = options.host || "127.0.0.1";
  const port = options.port || 0;
  const token = randomBytes(18).toString("hex");
  const server = createServer(createWebUiHandler({ ...options, token }));

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new CliError("Failed to determine local Web UI address.", "WEB_UI_ADDRESS_ERROR");
  }

  const url = `http://${host}:${(address as AddressInfo).port}/?token=${encodeURIComponent(token)}`;

  let opened = false;
  if (options.autoOpen !== false) {
    try {
      await (options.openBrowser || openBrowser)(url);
      opened = true;
    } catch {
      opened = false;
    }
  }

  return {
    url,
    opened,
    close: async () => {
      await closeServer(server);
    },
  };
}

/**
 * Creates the HTTP request handler used by the local Web UI server.
 */
export function createWebUiHandler(
  options: WebUiServerOptions & { token: string },
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request: IncomingMessage, response: ServerResponse) => {
    await handleRequest(request, response, options).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(response, 500, {
        error: {
          message,
        },
      });
    });
  };
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: WebUiServerOptions & { token: string },
): Promise<void> {
  const method = request.method || "GET";
  const url = new URL(request.url || "/", "http://127.0.0.1");
  const pathname = url.pathname;

  const asset = method === "GET" ? await loadStaticAsset(pathname).catch(() => null) : null;
  if (asset) {
    sendBuffer(response, 200, asset.body, asset.contentType);
    return;
  }

  if (method === "GET" && (pathname === "/" || pathname.startsWith("/skills/"))) {
    if (url.searchParams.get("token") !== context.token) {
      sendHtml(response, 403, "<h1>Forbidden</h1><p>Missing or invalid local session token.</p>");
      return;
    }

    sendHtml(
      response,
      200,
      await renderAppShell({
        token: context.token,
        initialScope: readRequestedScope(url.searchParams.get("scope")),
        initialSkillId: pathname.startsWith("/skills/") ? decodeURIComponent(pathname.slice("/skills/".length)) : null,
      }),
    );
    return;
  }

  if (!pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: { message: "Not found" } });
    return;
  }

  if (request.headers["x-skillex-token"] !== context.token) {
    sendJson(response, 401, { error: { message: "Missing or invalid Skillex session token." } });
    return;
  }

  if (method === "GET" && pathname === "/api/state") {
    sendJson(response, 200, await buildDashboardState(withRequestScope(context, url.searchParams.get("scope"))));
    return;
  }

  if (method === "GET" && pathname === "/api/catalog") {
    sendJson(response, 200, await buildCatalogResponse(withRequestScope(context, url.searchParams.get("scope"))));
    return;
  }

  if (method === "GET" && pathname.startsWith("/api/catalog/")) {
    const skillId = decodeURIComponent(pathname.slice("/api/catalog/".length));
    sendJson(response, 200, await buildSkillDetail(skillId, withRequestScope(context, url.searchParams.get("scope"))));
    return;
  }

  if (method === "GET" && pathname === "/api/sources") {
    sendJson(response, 200, await listProjectSources(withRequestScope(context, url.searchParams.get("scope"))));
    return;
  }

  if (method === "POST" && pathname === "/api/install") {
    const body = await readRequestBody<{ skillIds?: string[]; all?: boolean; repo?: string; ref?: string; scope?: RequestScope }>(request);
    const installOptions = withRequestScope(toProjectOptions(context), body.scope);
    if (body.repo) installOptions.repo = body.repo;
    if (body.ref) installOptions.ref = body.ref;
    const result = await installSkills(body.skillIds || [], {
      ...installOptions,
      ...(body.all ? { installAll: true } : {}),
      ...(context.catalogLoader ? { catalogLoader: context.catalogLoader } : {}),
      ...(context.downloader ? { downloader: context.downloader } : {}),
    });
    sendJson(response, 200, result);
    return;
  }

  if (method === "POST" && pathname === "/api/remove") {
    const body = await readRequestBody<{ skillIds?: string[]; scope?: RequestScope }>(request);
    sendJson(response, 200, await removeSkills(body.skillIds || [], withRequestScope(toProjectOptions(context), body.scope)));
    return;
  }

  if (method === "POST" && pathname === "/api/update") {
    const body = await readRequestBody<{ skillIds?: string[]; scope?: RequestScope }>(request);
    sendJson(
      response,
      200,
      await updateInstalledSkills(body.skillIds || [], {
        ...withRequestScope(toProjectOptions(context), body.scope),
        ...(context.catalogLoader ? { catalogLoader: context.catalogLoader } : {}),
        ...(context.downloader ? { downloader: context.downloader } : {}),
      }),
    );
    return;
  }

  if (method === "POST" && pathname === "/api/sync") {
    const body = await readRequestBody<{ adapter?: string; dryRun?: boolean; mode?: SyncWriteMode; scope?: RequestScope }>(request);
    const syncOptions = withRequestScope(toProjectOptions(context), body.scope);
    if (body.adapter) syncOptions.adapter = body.adapter;
    if (body.dryRun !== undefined) syncOptions.dryRun = body.dryRun;
    if (body.mode) syncOptions.mode = body.mode;
    sendJson(response, 200, await syncInstalledSkills(syncOptions));
    return;
  }

  if (method === "POST" && pathname === "/api/sources") {
    const body = await readRequestBody<{ repo?: string; ref?: string; label?: string; scope?: RequestScope }>(request);
    if (!body.repo) {
      throw new CliError("Provide owner/repo to add a source.", "WEB_UI_SOURCE_REQUIRES_REPO");
    }
    sendJson(
      response,
      200,
      await addProjectSource(
        {
          repo: body.repo,
          ...(body.ref ? { ref: body.ref } : {}),
          ...(body.label ? { label: body.label } : {}),
        },
        withRequestScope(toProjectOptions(context), body.scope),
      ),
    );
    return;
  }

  if (method === "DELETE" && pathname.startsWith("/api/sources/")) {
    const repo = decodeURIComponent(pathname.slice("/api/sources/".length));
    sendJson(response, 200, await removeProjectSource(repo, withRequestScope(toProjectOptions(context), url.searchParams.get("scope"))));
    return;
  }

  sendJson(response, 404, { error: { message: "Route not found" } });
}

async function buildDashboardState(options: ProjectOptions): Promise<DashboardState> {
  const cwd = path.resolve(options.cwd || process.cwd());
  const scope = options.scope || "local";
  const statePaths = getScopedStatePaths(cwd, {
    scope,
    baseDir: options.agentSkillsDir,
  });
  const lockfile = await getInstalledSkills({ ...options, cwd });
  const sources = await listProjectSources({ ...options, cwd });
  const adapters = lockfile?.adapters
    ? lockfile.adapters
    : await resolveAdapterState({
        cwd,
        ...(options.adapter ? { adapter: options.adapter } : {}),
      });

  return {
    scope,
    cwd,
    stateDir: statePaths.stateDir,
    initialized: Boolean(lockfile),
    sources,
    installed: Object.entries(lockfile?.installed || {}).map(([id, metadata]) => ({
      id,
      ...metadata,
    })),
    adapters: {
      active: adapters.active,
      detected: adapters.detected,
      supported: listAdapters(),
    },
    settings: {
      autoSync: lockfile?.settings.autoSync ?? true,
    },
    sync: lockfile?.sync || null,
    syncHistory: lockfile?.syncHistory || {},
  };
}

async function buildCatalogResponse(options: WebUiServerOptions): Promise<CatalogResponse> {
  const catalog = await loadProjectCatalogs(options, options.catalogLoader);
  const state = await getInstalledSkills(options);
  const installedIds = new Set(Object.keys(state?.installed || {}));

  return {
    formatVersion: catalog.formatVersion,
    sources: catalog.sources,
    skills: catalog.skills.map((skill) => ({
      ...skill,
      installed: installedIds.has(skill.id),
    })),
  };
}

async function buildSkillDetail(skillId: string, options: WebUiServerOptions): Promise<SkillDetailResponse> {
  const catalog = await buildCatalogResponse(options);
  const skill = catalog.skills.find((entry) => entry.id === skillId);
  if (!skill) {
    throw new CliError(`Skill "${skillId}" not found in the configured catalog sources.`, "WEB_UI_SKILL_NOT_FOUND");
  }

  let instructionsMarkdown = "";
  let instructionsError: string | null = null;
  try {
    instructionsMarkdown = await loadSkillInstructions(skill, options);
  } catch (error) {
    instructionsError = error instanceof Error ? error.message : String(error);
  }

  return {
    skill,
    instructionsMarkdown,
    instructionsHtml: instructionsMarkdown
      ? renderMarkdownToHtml(instructionsMarkdown)
      : "<p>Instructions are currently unavailable for this skill.</p>",
    instructionsError,
  };
}

async function loadSkillInstructions(skill: SourcedSkillManifest, options: WebUiServerOptions): Promise<string> {
  if (options.skillBodyLoader) {
    return options.skillBodyLoader(skill, { options });
  }

  const localContent = await readInstalledSkillInstructions(skill.id, options);
  if (localContent) {
    return localContent;
  }

  const remotePath = skill.path ? path.posix.join(skill.path, skill.entry) : skill.entry;
  return fetchText(buildRawGitHubUrl(skill.source.repo, skill.source.ref, remotePath), {
    headers: { Accept: "text/plain" },
  });
}

async function readInstalledSkillInstructions(skillId: string, options: ProjectOptions): Promise<string | null> {
  const cwd = path.resolve(options.cwd || process.cwd());
  const state = await getInstalledSkills({ ...options, cwd });
  const metadata = state?.installed?.[skillId];
  if (!metadata) {
    return null;
  }

  const skillDir = path.isAbsolute(metadata.path) ? metadata.path : path.resolve(cwd, metadata.path);
  const manifest = (await readJson<{ entry?: string }>(path.join(skillDir, "skill.json"), {})) || {};
  const entry = manifest.entry || "SKILL.md";
  return readText(path.join(skillDir, entry), null);
}

async function readRequestBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {} as T;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new CliError("Invalid JSON body in Web UI request.", "WEB_UI_INVALID_JSON");
  }
}

async function renderAppShell(bootstrap: WebUiBootstrap): Promise<string> {
  const uiDistDir = await resolveUiDistDir();
  const html = await readFile(path.join(uiDistDir, "index.html"), "utf8").catch(() => {
    throw new CliError(
      "Web UI assets are missing. Build the frontend with `npm run build:ui` before launching `skillex ui` from the repository checkout.",
      "WEB_UI_ASSETS_MISSING",
    );
  });

  const serializedBootstrap = JSON.stringify(bootstrap).replace(/</g, "\\u003c");
  if (!html.includes(UI_BOOTSTRAP_MARKER)) {
    throw new CliError("The built Web UI index is missing the bootstrap marker.", "WEB_UI_BOOTSTRAP_MARKER_MISSING");
  }
  return html.replace(UI_BOOTSTRAP_MARKER, serializedBootstrap);
}

async function loadStaticAsset(pathname: string): Promise<StaticAsset | null> {
  const uiDistDir = await resolveUiDistDir();
  const relativePath = pathname.replace(/^\/+/, "");
  if (!relativePath || relativePath === "index.html" || relativePath.startsWith("api/")) {
    return null;
  }

  const filePath = path.resolve(uiDistDir, relativePath);
  if (!isPathInside(filePath, uiDistDir)) {
    return null;
  }

  const body = await readFile(filePath).catch(() => null);
  if (!body) {
    return null;
  }

  return {
    body,
    contentType: inferContentType(filePath),
  };
}

async function resolveUiDistDir(): Promise<string> {
  const candidates: [string, string, string] = [
    path.resolve(MODULE_DIR, "..", "dist-ui"),
    path.resolve(MODULE_DIR, "..", "..", "dist-ui"),
    path.resolve(process.cwd(), "dist-ui"),
  ];

  for (const candidate of candidates) {
    const info = await stat(candidate).catch(() => null);
    if (info?.isDirectory()) {
      return candidate;
    }
  }

  return candidates[0];
}

function isPathInside(candidate: string, root: string): boolean {
  const normalizedRoot = `${path.resolve(root)}${path.sep}`;
  const normalizedCandidate = path.resolve(candidate);
  return normalizedCandidate === path.resolve(root) || normalizedCandidate.startsWith(normalizedRoot);
}

function inferContentType(filePath: string): string {
  switch (path.extname(filePath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".html":
      return "text/html; charset=utf-8";
    case ".ico":
      return "image/x-icon";
    case ".png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

async function openBrowser(url: string): Promise<void> {
  if (process.platform === "darwin") {
    await spawnDetached("open", [url]);
    return;
  }

  if (process.platform === "win32") {
    await spawnDetached("cmd", ["/c", "start", "", url]);
    return;
  }

  await spawnDetached("xdg-open", [url]);
}

async function spawnDetached(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendHtml(response: ServerResponse, statusCode: number, html: string): void {
  sendText(response, statusCode, html, "text/html; charset=utf-8");
}

function sendText(response: ServerResponse, statusCode: number, body: string, contentType: string): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", contentType);
  response.end(body);
}

function sendBuffer(response: ServerResponse, statusCode: number, body: Buffer, contentType: string): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", contentType);
  response.end(body);
}
