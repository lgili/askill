#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, validateSkillRepoCatalog } from "./init_repo_skill.js";

const CURRENT_FILE = fileURLToPath(import.meta.url);

async function main() {
  try {
    const flags = parseArgs(process.argv.slice(2));
    const result = await validateSkillRepoCatalog({
      root: flags.root,
    });

    console.log(`Catalogo valido: ${result.catalogPath}`);
    console.log(`Skills encontradas: ${result.skillCount}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === CURRENT_FILE;
if (isMainModule) {
  await main();
}