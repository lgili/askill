import type { SkillManifest } from "./types.js";

interface UiChoice {
  name: string;
  value: string;
  checked?: boolean | undefined;
}

interface UiPrompts {
  input?: ((options: { message: string; default?: string | undefined }) => Promise<string>) | undefined;
  checkbox?:
    | ((options: {
        message: string;
        instructions?: string | undefined;
        pageSize?: number | undefined;
        choices: UiChoice[];
      }) => Promise<string[]>)
    | undefined;
}

/**
 * Filters catalog skills for the interactive terminal browser using a case-insensitive text query.
 *
 * @param skills - Catalog skills.
 * @param query - Search text.
 * @returns Filtered skills in their original order.
 */
export function filterCatalogForUi<T extends SkillManifest>(skills: T[], query: string): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return skills;
  }

  return skills.filter((skill) =>
    [skill.id, skill.name, skill.description, skill.compatibility.join(","), skill.tags.join(",")]
      .join("\n")
      .toLowerCase()
      .includes(normalized),
  );
}

/**
 * Runs the interactive terminal browser flow used by `skillex`, `skillex browse`, and `skillex tui`.
 *
 * @param options - UI state and optional prompt overrides.
 * @returns Selected, installable, and removable skill ids.
 */
export async function runInteractiveUi<T extends SkillManifest & { source?: { repo: string; label?: string | undefined } }>(options: {
  skills: T[];
  installedIds: string[];
  prompts?: UiPrompts | undefined;
}): Promise<{
  query: string;
  visibleIds: string[];
  selectedIds: string[];
  toInstall: string[];
  toRemove: string[];
}> {
  const prompts = options.prompts || (await loadPromptAdapters());
  const query = await (prompts.input || fallbackInput)({
    message: "Filtro das skills (Enter para mostrar tudo)",
    default: "",
  });
  const filteredSkills = filterCatalogForUi(options.skills, query);
  const installedSet = new Set(options.installedIds);
  const visibleIds = filteredSkills.map((skill) => skill.id);

  const selectedIds =
    filteredSkills.length === 0
      ? []
      : await (prompts.checkbox || fallbackCheckbox)({
          message: "Select skills",
          instructions: "↑↓ navigate  ·  space select  ·  enter confirm  ·  type to filter",
          pageSize: 12,
          choices: filteredSkills.map((skill) => {
            const tags = (skill.tags ?? []).slice(0, 4).join(", ");
            const detail = tags || (skill.description ?? "").slice(0, 55);
            const source =
              skill.source && (skill.source.label || skill.source.repo)
                ? `  ·  ${skill.source.label || skill.source.repo}`
                : "";
            const label = detail
              ? `${skill.name}  (${skill.id})  ·  ${detail}${source}`
              : `${skill.name}  (${skill.id})${source}`;
            return {
              name: label,
              value: skill.id,
              checked: installedSet.has(skill.id),
            };
          }),
        });

  const selectedSet = new Set(selectedIds);
  const toInstall = selectedIds.filter((skillId) => !installedSet.has(skillId));
  const toRemove = visibleIds.filter((skillId) => installedSet.has(skillId) && !selectedSet.has(skillId));

  return {
    query,
    visibleIds,
    selectedIds,
    toInstall,
    toRemove,
  };
}

async function loadPromptAdapters(): Promise<Required<UiPrompts>> {
  const prompts = await import("@inquirer/prompts");
  return {
    input: async (options) =>
      prompts.input({
        message: options.message,
        ...(options.default !== undefined ? { default: options.default } : {}),
      }),
    checkbox: async (options) =>
      prompts.checkbox({
        message: options.message,
        ...(options.instructions ? { instructions: options.instructions } : {}),
        ...(options.pageSize !== undefined ? { pageSize: options.pageSize } : {}),
        choices: options.choices.map((choice) => ({
          name: choice.name,
          value: choice.value,
          ...(choice.checked !== undefined ? { checked: choice.checked } : {}),
        })),
      }) as Promise<string[]>,
  };
}

async function fallbackInput(): Promise<string> {
  return "";
}

async function fallbackCheckbox(): Promise<string[]> {
  return [];
}
