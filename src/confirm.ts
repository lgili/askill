import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { CliError } from "./types.js";

/**
 * Prompts the user for a yes/no confirmation in interactive terminals.
 *
 * @param message - Prompt shown to the user.
 * @returns `true` when the user confirms.
 * @throws {CliError} When interactive input is unavailable.
 */
export async function confirmAction(message: string): Promise<boolean> {
  if (!input.isTTY || !output.isTTY) {
    throw new CliError("Confirmacao interativa indisponivel neste terminal. Use a flag correspondente.", "TTY_REQUIRED");
  }

  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`${message} [y/N] `);
    const normalized = answer.trim().toLowerCase();
    return normalized === "y" || normalized === "yes" || normalized === "s" || normalized === "sim";
  } finally {
    rl.close();
  }
}
