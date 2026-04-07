import {
  DEFAULT_CATALOG_PATH,
  DEFAULT_REF,
  DEFAULT_REPO,
  DEFAULT_SKILLS_DIR,
} from "./config.js";
import { normalizeAdapterList } from "./adapters.js";
import { assertSafeRelativePath } from "./fs.js";
import { fetchJson, fetchOptionalJson } from "./http.js";

export async function loadCatalog(options = {}) {
  const source = resolveSource(options);
  const catalogUrl = source.catalogUrl || buildRawGitHubUrl(source.repo, source.ref, source.catalogPath);
  const remoteCatalog = await fetchOptionalJson(catalogUrl);

  if (remoteCatalog) {
    return normalizeCatalog(remoteCatalog, source);
  }

  return loadCatalogFromTree(source);
}

export function resolveSource(options = {}) {
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

export function parseGitHubRepo(input) {
  if (!input || !input.trim()) {
    throw new Error("Informe um repositorio GitHub no formato owner/repo ou uma URL do GitHub.");
  }

  const trimmed = input.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const url = new URL(trimmed);
    if (url.hostname !== "github.com") {
      throw new Error("Apenas URLs do github.com sao suportadas nesta versao.");
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      throw new Error(`Nao foi possivel extrair owner/repo de "${trimmed}".`);
    }

    const result = { owner: parts[0], repo: parts[1], ref: null };
    if (parts[2] === "tree" && parts[3]) {
      result.ref = parts.slice(3).join("/");
    }
    return result;
  }

  const parts = trimmed.split("/");
  if (parts.length !== 2) {
    throw new Error(`Repositorio invalido "${trimmed}". Use owner/repo.`);
  }

  return { owner: parts[0], repo: parts[1], ref: null };
}

export function buildRawGitHubUrl(repo, ref, filePath) {
  return `https://raw.githubusercontent.com/${repo}/${encodeRef(ref)}/${stripLeadingSlash(filePath)}`;
}

export function buildGitHubApiUrl(repo, ref) {
  return `https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
}

async function loadCatalogFromTree(source) {
  const tree = await fetchJson(buildGitHubApiUrl(source.repo, source.ref));
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
        const manifestJson = await fetchJson(
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
    throw new Error(
      `Nenhum catalogo encontrado em ${source.repo}@${source.ref}. Esperado: ${source.catalogPath}, manifests em ${source.skillsDir}/*/skill.json ou pastas com SKILL.md.`,
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

async function fetchJsonLikeText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/plain",
      "User-Agent": "askill",
    },
  });
  if (!response.ok) {
    throw new Error(`Falha ao baixar arquivo ${url} (${response.status})`);
  }
  return response.text();
}

function extractSkillMetadata(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) {
    return {};
  }

  const frontmatter = match[1];
  return {
    name: extractFrontmatterValue(frontmatter, "name"),
    description: extractFrontmatterValue(frontmatter, "description"),
  };
}

function extractFrontmatterValue(frontmatter, key) {
  const expression = new RegExp(`^${key}:\\s*(.+)$`, "m");
  const match = frontmatter.match(expression);
  if (!match) {
    return null;
  }
  return match[1].trim().replace(/^["']|["']$/g, "");
}

function collectFilesUnderPath(treeFiles, skillPath) {
  return treeFiles
    .filter((item) => item.type === "blob" && item.path.startsWith(`${skillPath}/`))
    .map((item) => assertSafeRelativePath(item.path.slice(skillPath.length + 1)));
}

function normalizeCatalog(remoteCatalog, source) {
  const remoteSkills = Array.isArray(remoteCatalog.skills) ? remoteCatalog.skills : [];
  if (remoteSkills.length === 0) {
    throw new Error("catalog.json encontrado, mas sem a chave skills preenchida.");
  }

  return {
    formatVersion: Number(remoteCatalog.formatVersion || 1),
    repo: remoteCatalog.repo || source.repo,
    ref: remoteCatalog.ref || source.ref,
    skills: sortSkills(remoteSkills.map((skill) => normalizeSkill(skill, source))),
  };
}

function normalizeSkill(skill, source) {
  const id = skill.id || skill.slug;
  if (!id) {
    throw new Error("Toda skill precisa de um id.");
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

export function searchCatalogSkills(skills, options = {}) {
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

function stripLeadingSlash(value) {
  return value.replace(/^\/+/, "");
}

function encodeRef(ref) {
  return ref
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function normalizeFilterList(value) {
  if (!value) {
    return [];
  }

  const items = Array.isArray(value) ? value : String(value).split(",");
  return [...new Set(items.map((item) => item.trim().toLowerCase()).filter(Boolean))];
}

function sortSkills(skills) {
  return [...skills].sort((left, right) => left.id.localeCompare(right.id));
}
