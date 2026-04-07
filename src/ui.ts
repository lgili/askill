import type { SkillManifest } from "./types.js";

interface UiChoice {
  name: string;
  value: string;
  checked?: boolean | undefined;
}

interface UiPrompts {
  input?: ((options: { message: string; default?: string | undefined }) => Promise<string>) | undefined;
  checkbox?:
    | ((options: { message: string; instructions?: string | undefined; choices: UiChoice[] }) => Promise<string[]>)
    | undefined;
}

/**
 * Filters catalog skills for the interactive UI using a case-insensitive text query.
 *
 * @param skills - Catalog skills.
 * @param query - Search text.
 * @returns Filtered skills in their original order.
 */
export function filterCatalogForUi(skills: SkillManifest[], query: string): SkillManifest[] {
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
 * Runs the interactive terminal flow used by `skillex ui`.
 *
 * @param options - UI state and optional prompt overrides.
 * @returns Selected, installable, and removable skill ids.
 */
export async function runInteractiveUi(options: {
  skills: SkillManifest[];
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
          message: "Selecione as skills",
          instructions: "Type to filter first • Space to select • Enter to install",
          choices: filteredSkills.map((skill) => ({
            name: `${skill.name} (${skill.id}) - ${skill.description || "Sem descricao"} [${skill.compatibility.join(",") || "sem-compat"}]`,
            value: skill.id,
            checked: installedSet.has(skill.id),
          })),
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
