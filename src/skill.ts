/**
 * Parsed frontmatter values supported by Skillex skills.
 */
export interface SkillFrontmatter {
  name?: string | undefined;
  description?: string | undefined;
  autoInject?: boolean | undefined;
  activationPrompt?: string | undefined;
}

/**
 * Parses the YAML-like frontmatter at the top of a `SKILL.md` file.
 *
 * @param content - Raw markdown content.
 * @returns Parsed frontmatter fields relevant to Skillex.
 */
export function parseSkillFrontmatter(content: string): SkillFrontmatter {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match || match[1] === undefined) {
    return {};
  }

  const values: SkillFrontmatter = {};
  for (const rawLine of match[1].split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const value = normalizeFrontmatterValue(rawValue);

    if (key === "name" && typeof value === "string") {
      values.name = value;
    }
    if (key === "description" && typeof value === "string") {
      values.description = value;
    }
    if (key === "autoInject" && typeof value === "boolean") {
      values.autoInject = value;
    }
    if (key === "activationPrompt" && typeof value === "string") {
      values.activationPrompt = value;
    }
  }

  return values;
}

/**
 * Removes supported frontmatter and the top-level heading from a skill document.
 *
 * @param content - Raw markdown content.
 * @returns Normalized markdown body.
 */
export function normalizeSkillContent(content: string): string {
  const withoutFrontmatter = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");
  const withoutTopHeading = withoutFrontmatter.replace(/^#\s+.+\n+/, "");
  return withoutTopHeading.trim();
}

function normalizeFrontmatterValue(value: string): string | boolean {
  const trimmed = value.trim().replace(/^["']|["']$/g, "");
  const normalized = trimmed.toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return trimmed;
}
