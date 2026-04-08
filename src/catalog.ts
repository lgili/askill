import { createHash } from "node:crypto";
import * as nodeFs from "node:fs/promises";
import * as path from "node:path";
import {
  DEFAULT_CATALOG_PATH,
  DEFAULT_REF,
  DEFAULT_REPO,
  DEFAULT_SKILLS_DIR,
} from "./config.js";
import { normalizeAdapterList } from "./adapters.js";
import { assertSafeRelativePath } from "./fs.js";
import { fetchJson, fetchOptionalJson, fetchText } from "./http.js";
import { debug } from "./output.js";
import type {
  CatalogData,
  CatalogSource,
  CatalogSourceInput,
  ParsedGitHubRepo,
  SearchOptions,
  SkillManifest,
} from "./types.js";
import { CatalogError } from "./types.js";

// ---------------------------------------------------------------------------
// Catalog cache
// ---------------------------------------------------------------------------

interface CatalogCache {
  expiresAt: string;
  data: CatalogData;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Reads a cached catalog from disk.
 *
 * @param cacheDir - Directory where cache files are stored.
 * @param cacheKey - Unique key for this catalog source.
 * @returns Cached catalog data, or `null` if missing or expired.
 */
export async function readCatalogCache(cacheDir: string, cacheKey: string): Promise<CatalogData | null> {
  const cachePath = path.join(cacheDir, `${cacheKey}.json`);
  try {
    const content = await nodeFs.readFile(cachePath, "utf-8");
    const cache = JSON.parse(content) as CatalogCache;
    if (new Date(cache.expiresAt).getTime() > Date.now()) {
      return cache.data;
    }
    return null; // expired
  } catch {
    return null; // missing or invalid
  }
}

/**
 * Writes catalog data to the local cache with a 5-minute TTL.
 *
 * @param cacheDir - Directory where cache files are stored.
 * @param cacheKey - Unique key for this catalog source.
 * @param data - Catalog data to cache.
 */
export async function writeCatalogCache(cacheDir: string, cacheKey: string, data: CatalogData): Promise<void> {
  const cachePath = path.join(cacheDir, `${cacheKey}.json`);
  const cache: CatalogCache = {
    expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    data,
  };
  await nodeFs.mkdir(cacheDir, { recursive: true });
  await nodeFs.writeFile(cachePath, JSON.stringify(cache), "utf-8");
}

/**
 * Computes a short, stable cache key for a catalog source URL.
 *
 * @param source - Resolved catalog source.
 * @returns 16-character hex string.
 */
export function computeCatalogCacheKey(source: CatalogSource): string {
  const url = source.catalogUrl ?? buildRawGitHubUrl(source.repo, source.ref, source.catalogPath);
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

interface GitTreeItem {
  path: string;
  type: string;
}

interface GitTreeResponse {
  tree?: GitTreeItem[];
}

type RemoteCatalog = Partial<CatalogData> & { skills?: Array<Partial<SkillManifest>> };
interface SkillCandidate {
  id?: string | undefined;
  slug?: string | undefined;
  path?: string | undefined;
  name?: string | undefined;
  version?: string | undefined;
  description?: string | undefined;
  author?: string | null | undefined;
  tags?: string[] | undefined;
  compatibility?: string[] | undefined;
  entry?: string | undefined;
  files?: string[] | undefined;
}

/**
 * Loads a remote skill catalog from `catalog.json` or falls back to repository tree inspection.
 *
 * @param options - Catalog source overrides.
 * @returns Normalized remote catalog data.
 * @throws {CatalogError} When the catalog cannot be fetched or normalized.
 */
export async function loadCatalog(options: CatalogSourceInput = {}): Promise<CatalogData> {
  try {
    const source = resolveSource(options);
    const cacheDir = options.cacheDir;
    const cacheKey = computeCatalogCacheKey(source);

    // Check local cache first
    if (cacheDir && !options.noCache) {
      const cached = await readCatalogCache(cacheDir, cacheKey);
      if (cached) {
        debug(`Catalog cache hit for ${source.repo}@${source.ref}`);
        return cached;
      }
      debug(`Catalog cache miss — fetching from network`);
    }

    const catalogUrl = source.catalogUrl ?? buildRawGitHubUrl(source.repo, source.ref, source.catalogPath);
    const remoteCatalog = await fetchOptionalJson<RemoteCatalog>(catalogUrl);
    const result = remoteCatalog ? await normalizeCatalog(remoteCatalog, source) : await loadCatalogFromTree(source);

    // Write to cache (fire-and-forget; never fail the caller)
    if (cacheDir) {
      writeCatalogCache(cacheDir, cacheKey, result).catch(() => {});
    }

    return result;
  } catch (error) {
    if (error instanceof CatalogError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new CatalogError(`Failed to load catalog: ${message}`);
  }
}

/**
 * Resolves the effective GitHub catalog source from CLI options.
 *
 * @param options - Catalog source overrides.
 * @returns Normalized catalog source.
 * @throws {CatalogError} When the repository reference is invalid.
 */
export function resolveSource(options: CatalogSourceInput = {}): CatalogSource {
  const repoParts = parseGitHubRepo(options.repo || DEFAULT_REPO);
  return {
    owner: repoParts.owner,
    repoName: repoParts.repo,
    repo: `${repoParts.owner}/${repoParts.repo}`,
    ref: options.ref || repoParts.ref || DEFAULT_REF,
    catalogPath: options.catalogPath || DEFAULT_CATALOG_PATH,
    skillsDir: options.skillsDir || DEFAULT_SKILLS_DIR,
    catalogUrl: options.catalogUrl || null,
  };
}

/**
 * Parses a GitHub repository reference in `owner/repo` or GitHub URL format.
 *
 * @param input - Repository reference to parse.
 * @returns Parsed GitHub repository parts.
 * @throws {CatalogError} When the input cannot be parsed.
 */
export function parseGitHubRepo(input: string): ParsedGitHubRepo {
  if (!input || !input.trim()) {
    throw new CatalogError("Provide a GitHub repository in owner/repo format or a GitHub URL.", "INVALID_REPOSITORY");
  }

  const trimmed = input.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const url = new URL(trimmed);
    if (url.hostname !== "github.com") {
      throw new CatalogError("Only github.com URLs are supported.", "INVALID_REPOSITORY");
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      throw new CatalogError(`Could not extract owner/repo from "${trimmed}".`, "INVALID_REPOSITORY");
    }

    const result: ParsedGitHubRepo = { owner: parts[0]!, repo: parts[1]!, ref: null };
    if (parts[2] === "tree" && parts[3]) {
      result.ref = parts.slice(3).join("/");
    }
    return result;
  }

  const parts = trimmed.split("/");
  if (parts.length !== 2) {
    throw new CatalogError(`Invalid repository "${trimmed}". Use owner/repo format.`, "INVALID_REPOSITORY");
  }

  return { owner: parts[0]!, repo: parts[1]!, ref: null };
}

/**
 * Builds a raw GitHub content URL for a repository file.
 *
 * @param repo - Repository in `owner/name` format.
 * @param ref - Branch, tag, or commit.
 * @param filePath - Repository-relative file path.
 * @returns Raw GitHub content URL.
 */
export function buildRawGitHubUrl(repo: string, ref: string, filePath: string): string {
  return `https://raw.githubusercontent.com/${repo}/${encodeRef(ref)}/${stripLeadingSlash(filePath)}`;
}

/**
 * Builds the GitHub tree API URL for a repository reference.
 *
 * @param repo - Repository in `owner/name` format.
 * @param ref - Branch, tag, or commit.
 * @returns GitHub API URL for recursive tree inspection.
 */
export function buildGitHubApiUrl(repo: string, ref: string): string {
  return `https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
}

async function loadCatalogFromTree(source: CatalogSource): Promise<CatalogData> {
  const tree = await fetchJson<GitTreeResponse>(buildGitHubApiUrl(source.repo, source.ref));
  const files = Array.isArray(tree.tree) ? tree.tree : [];
  const manifests = files.filter((item) => {
    if (item.type !== "blob") {
      return false;
    }
    return item.path.startsWith(`${source.skillsDir}/`) && item.path.endsWith("/skill.json");
  });

  if (manifests.length > 0) {
    const skills = await Promise.all(
      manifests.map(async (manifest) => {
        const manifestJson = await fetchJson<Partial<SkillManifest>>(
          buildRawGitHubUrl(source.repo, source.ref, manifest.path),
          { headers: { Accept: "application/json" } },
        );
        const skillPath = manifest.path.slice(0, -"/skill.json".length);
        const skillId = skillPath.split("/").pop();
        return normalizeSkill(
          {
            id: skillId,
            path: skillPath,
            files: collectFilesUnderPath(files, skillPath),
            ...manifestJson,
          },
          source,
        );
      }),
    );

    return {
      formatVersion: 1,
      repo: source.repo,
      ref: source.ref,
      skills,
    };
  }

  const skillFiles = files.filter((item) => {
    if (item.type !== "blob") {
      return false;
    }
    if (!item.path.endsWith("/SKILL.md")) {
      return false;
    }
    return !item.path.split("/").some((segment) => segment.startsWith("."));
  });

  if (skillFiles.length === 0) {
    throw new CatalogError(
      `No catalog found at ${source.repo}@${source.ref}. Expected: ${source.catalogPath}, manifests at ${source.skillsDir}/*/skill.json, or folders containing SKILL.md.`,
      "CATALOG_NOT_FOUND",
    );
  }

  const skills = await Promise.all(
    skillFiles.map(async (skillFile) => {
      const skillPath = skillFile.path.slice(0, -"/SKILL.md".length);
      const skillId = skillPath.split("/").pop();
      const skillBody = await fetchJsonLikeText(buildRawGitHubUrl(source.repo, source.ref, skillFile.path));
      const metadata = extractSkillMetadata(skillBody);

      return normalizeSkill(
        {
          id: skillId,
          path: skillPath,
          name: metadata.name || skillId,
          description: metadata.description || "",
          files: collectFilesUnderPath(files, skillPath),
        },
        source,
      );
    }),
  );

  return {
    formatVersion: 1,
    repo: source.repo,
    ref: source.ref,
    skills: sortSkills(skills),
  };
}

async function fetchJsonLikeText(url: string): Promise<string> {
  return fetchText(url, { headers: { Accept: "text/plain" } });
}

function extractSkillMetadata(content: string): { name?: string; description?: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) {
    return {};
  }

  const frontmatter = match[1];
  if (frontmatter === undefined) {
    return {};
  }

  const name = extractFrontmatterValue(frontmatter, "name");
  const description = extractFrontmatterValue(frontmatter, "description");

  return {
    ...(name !== null ? { name } : {}),
    ...(description !== null ? { description } : {}),
  };
}

function extractFrontmatterValue(frontmatter: string, key: string): string | null {
  const expression = new RegExp(`^${key}:\\s*(.+)$`, "m");
  const match = frontmatter.match(expression);
  if (!match) {
    return null;
  }
  const value = match[1];
  if (value === undefined) {
    return null;
  }
  return value.trim().replace(/^["']|["']$/g, "");
}

function collectFilesUnderPath(treeFiles: GitTreeItem[], skillPath: string): string[] {
  return treeFiles
    .filter((item) => item.type === "blob" && item.path.startsWith(`${skillPath}/`))
    .map((item) => assertSafeRelativePath(item.path.slice(skillPath.length + 1)));
}

async function normalizeCatalog(remoteCatalog: RemoteCatalog, source: CatalogSource): Promise<CatalogData> {
  const remoteSkills = Array.isArray(remoteCatalog.skills) ? remoteCatalog.skills : [];
  if (remoteSkills.length === 0) {
    throw new CatalogError("catalog.json found but the skills array is empty.", "CATALOG_EMPTY");
  }

  // v2 format: slim index entries (only `id`). Fetch each skill.json for full metadata.
  const isV2 =
    Number(remoteCatalog.formatVersion) >= 2 ||
    remoteSkills.every((s) => Object.keys(s).length === 1 && "id" in s);

  let skills: SkillManifest[];

  if (isV2) {
    skills = await Promise.all(
      remoteSkills.map(async (entry) => {
        const id = entry.id;
        if (!id) {
          throw new CatalogError("Every skill must have an id field.", "MALFORMED_SKILL");
        }
        const skillPath = `${source.skillsDir}/${id}`;
        const manifestUrl = buildRawGitHubUrl(source.repo, source.ref, `${skillPath}/skill.json`);
        const manifest = await fetchJson<Partial<SkillManifest>>(manifestUrl, {
          headers: { Accept: "application/json" },
        });
        return normalizeSkill({ ...manifest, id, path: skillPath }, source);
      }),
    );
  } else {
    skills = remoteSkills.map((skill) => normalizeSkill(skill, source));
  }

  return {
    formatVersion: Number(remoteCatalog.formatVersion || 1),
    repo: remoteCatalog.repo || source.repo,
    ref: remoteCatalog.ref || source.ref,
    skills: sortSkills(skills),
  };
}

function normalizeSkill(skill: SkillCandidate, source: CatalogSource): SkillManifest {
  const id = skill.id || skill.slug;
  if (!id) {
    throw new CatalogError("Every skill must have an id field.", "MALFORMED_SKILL");
  }

  const skillPath = skill.path || `${source.skillsDir}/${id}`;
  const files = Array.isArray(skill.files) ? skill.files.map(assertSafeRelativePath) : ["SKILL.md"];
  const uniqueFiles = [...new Set(files)];

  return {
    id,
    name: skill.name || id,
    version: skill.version || "0.1.0",
    description: skill.description || "",
    author: skill.author || null,
    tags: Array.isArray(skill.tags) ? skill.tags : [],
    compatibility: normalizeAdapterList(skill.compatibility),
    entry: skill.entry || "SKILL.md",
    path: stripLeadingSlash(skillPath),
    files: uniqueFiles,
  };
}

/**
 * Filters a list of skills using text, compatibility, and tag criteria.
 *
 * @param skills - Skills to search.
 * @param options - Search filters.
 * @returns Matching skills ordered by id.
 */
export function searchCatalogSkills(skills: SkillManifest[], options: SearchOptions = {}): SkillManifest[] {
  const query = String(options.query || "").trim().toLowerCase();
  const compatibility = normalizeAdapterList(options.compatibility);
  const tags = normalizeFilterList(options.tags);

  return sortSkills(
    skills.filter((skill) => {
      if (compatibility.length > 0) {
        const supported = new Set(normalizeAdapterList(skill.compatibility));
        if (!compatibility.every((item) => supported.has(item))) {
          return false;
        }
      }

      if (tags.length > 0) {
        const availableTags = new Set((skill.tags || []).map((item) => item.toLowerCase()));
        if (!tags.every((item) => availableTags.has(item))) {
          return false;
        }
      }

      if (!query) {
        return true;
      }

      const haystack = [
        skill.id,
        skill.name,
        skill.description,
        ...(skill.tags || []),
        ...(skill.compatibility || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    }),
  );
}

function stripLeadingSlash(value: string): string {
  return value.replace(/^\/+/, "");
}

function encodeRef(ref: string): string {
  return ref
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function normalizeFilterList(value: string[] | string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  const items = Array.isArray(value) ? value : String(value).split(",");
  return [...new Set(items.map((item) => item.trim().toLowerCase()).filter(Boolean))];
}

function sortSkills(skills: SkillManifest[]): SkillManifest[] {
  return [...skills].sort((left, right) => left.id.localeCompare(right.id));
}
