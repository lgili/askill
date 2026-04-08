import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

const WORKSPACE_ROOT = process.cwd();
const BOOTSTRAP_SCRIPT = path.join(
  WORKSPACE_ROOT,
  "skills",
  "latex-pro",
  "scripts",
  "bootstrap_latex_project.py",
);
const COMPILE_SCRIPT = path.join(
  WORKSPACE_ROOT,
  "skills",
  "latex-pro",
  "scripts",
  "compile_latex_project.py",
);

const TEMPLATE_CASES = [
  {
    template: "lab-report-green",
    expectedFiles: ["engreportgreen.sty", "chapters/01_overview.tex"],
    expectedPrimaryTitle: "Laboratory",
    expectedSecondaryTitle: "Report",
  },
  {
    template: "test-report-green",
    expectedFiles: ["engreportgreen.sty", "chapters/01_objectives.tex"],
    expectedPrimaryTitle: "Test",
    expectedSecondaryTitle: "Report",
  },
  {
    template: "validation-report-green",
    expectedFiles: ["engreportgreen.sty", "chapters/01_scope.tex"],
    expectedPrimaryTitle: "Validation",
    expectedSecondaryTitle: "Report",
  },
  {
    template: "design-report-green",
    expectedFiles: ["engreportgreen.sty", "chapters/01_context.tex"],
    expectedPrimaryTitle: "Design",
    expectedSecondaryTitle: "Report",
  },
  {
    template: "failure-analysis-green",
    expectedFiles: ["engreportgreen.sty", "chapters/01_incident-summary.tex"],
    expectedPrimaryTitle: "Failure Analysis",
    expectedSecondaryTitle: "Report",
  },
] as const;

test("latex-pro bootstrap scaffolds all green engineering report templates", async (t: TestContext) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-latex-pro-"));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  for (const templateCase of TEMPLATE_CASES) {
    const targetRoot = path.join(root, templateCase.template);
    const scaffold = spawnSync(
      "python3",
      [
        BOOTSTRAP_SCRIPT,
        "--repo-root",
        targetRoot,
        "--template",
        templateCase.template,
        "--title",
        "Demo Project",
        "--author",
        "Automation",
        "--with-latexmkrc",
      ],
      {
        cwd: WORKSPACE_ROOT,
        encoding: "utf8",
      },
    );

    assert.equal(
      scaffold.status,
      0,
      `bootstrap failed for ${templateCase.template}: ${scaffold.stderr || scaffold.stdout}`,
    );

    for (const relativePath of templateCase.expectedFiles) {
      assert.equal(
        await fileExists(path.join(targetRoot, relativePath)),
        true,
        `missing ${relativePath} for ${templateCase.template}`,
      );
    }

    assert.equal(await fileExists(path.join(targetRoot, "img", ".gitkeep")), true);

    const mainTex = await fs.readFile(path.join(targetRoot, "main.tex"), "utf8");
    assert.match(mainTex, new RegExp(String.raw`\\setreporttitleprimary\{${escapeRegExp(templateCase.expectedPrimaryTitle)}\}`));
    assert.match(mainTex, new RegExp(String.raw`\\setreporttitlesecondary\{${escapeRegExp(templateCase.expectedSecondaryTitle)}\}`));
    assert.equal(mainTex.includes("{{{"), false, `placeholder not rendered for ${templateCase.template}`);
  }
});

test("latex-pro compile planner produces a dry-run for green report templates", async (t: TestContext) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skillex-latex-compile-"));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const targetRoot = path.join(root, "validation-report-green");
  const scaffold = spawnSync(
    "python3",
    [
      BOOTSTRAP_SCRIPT,
      "--repo-root",
      targetRoot,
      "--template",
      "validation-report-green",
      "--title",
      "Validation Demo",
      "--author",
      "Automation",
    ],
    {
      cwd: WORKSPACE_ROOT,
      encoding: "utf8",
    },
  );

  assert.equal(scaffold.status, 0, scaffold.stderr || scaffold.stdout);

  const dryRun = spawnSync(
    "python3",
    [COMPILE_SCRIPT, "--repo-root", targetRoot, "--dry-run"],
    {
      cwd: WORKSPACE_ROOT,
      encoding: "utf8",
    },
  );

  assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
  assert.match(dryRun.stdout, /Engine:/);
  assert.match(dryRun.stdout, /Commands:/);
});

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
