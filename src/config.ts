import * as path from "node:path";
import type { StatePaths } from "./types.js";

export const DEFAULT_AGENT_SKILLS_DIR = ".agent-skills";
export const DEFAULT_LOCKFILE = "skills.json";
export const DEFAULT_LOCAL_SKILLS_DIR = "skills";
export const DEFAULT_GENERATED_DIR = "generated";
export const DEFAULT_CATALOG_PATH = "catalog.json";
export const DEFAULT_SKILLS_DIR = "skills";
export const DEFAULT_REPO = "owner/repo";
export const DEFAULT_REF = "main";

/**
 * Resolves the managed workspace state paths used by Skillex.
 *
 * @param cwd - Workspace root.
 * @param baseDir - Managed local state directory.
 * @returns Absolute paths for the state directory and lockfile.
 */
export function getStatePaths(cwd: string, baseDir = DEFAULT_AGENT_SKILLS_DIR): StatePaths {
  const stateDir = path.resolve(cwd, baseDir);
  return {
    stateDir,
    lockfilePath: path.join(stateDir, DEFAULT_LOCKFILE),
    skillsDirPath: path.join(stateDir, DEFAULT_LOCAL_SKILLS_DIR),
    generatedDirPath: path.join(stateDir, DEFAULT_GENERATED_DIR),
  };
}
