---
name: latex-pro
description: LaTeX document engineering for articles, reports, theses, books, Beamer slides, posters, resumes, bibliographies, figures, tables, TikZ, and robust compilation/debugging workflows. Use when working with `.tex`, `.bib`, `latexmkrc`, bibliography issues, `pdflatex`/`xelatex`/`lualatex`, BibTeX/biber, package errors, document layout, academic writing, math notes, conference submissions, or PDF-ready publishing. Trigger for asks like "latex", "beamer", "tikz", "thesis", "paper template", "citation broken", "fix this latex error", "bibliography", "resume in latex", "poster", or "convert content into LaTeX".
---

# LaTeX Pro

## Overview

Use this skill to design, scaffold, compile, debug, and polish LaTeX projects
for academic, technical, business, and presentation workflows.

Default stance:

- Pick the simplest document class and package set that fits the output.
- Keep the preamble intentional; every package should earn its place.
- Separate content, figures, tables, and bibliography instead of dumping everything into one file.
- Treat compilation and bibliography errors as workflow problems to debug systematically.
- Prefer reproducible builds and submission-safe defaults over fragile visual hacks.

## Core Workflow

1. Identify the document goal and hard constraints.
   - Confirm document type: article, report, thesis, book, Beamer, poster, or resume.
   - Confirm target venue or output rules: page limits, bibliography style, class file, engine, and paper size.
   - Identify whether the user needs original writing, cleanup, conversion into LaTeX, or debugging of an existing project.

2. Choose a project structure before writing.
   - Single-file documents are fine for short notes and simple resumes.
   - Multi-file structure is better for theses, books, reports, large papers, and slide decks.
   - Use `figures/`, `tables/`, `sections/`, and `.bib` files instead of burying everything in `main.tex`.

3. Build the preamble and content model deliberately.
   - Select engine based on content needs: `pdflatex` for portability, `xelatex`/`lualatex` for modern fonts and multilingual work.
   - Keep typography, citations, theorem environments, graphics, and table tooling explicit.
   - Use semantic macros for repeated notation, theorem styles, and recurring formatting.

4. Write and format with publication in mind.
   - Keep sections, figures, captions, labels, and citations consistent.
   - Prefer `booktabs`, `siunitx`, `cleveref`, and robust bibliography workflows.
   - For math-heavy content, keep notation and theorem styling consistent across the document.

5. Compile and debug systematically.
   - Run `scripts/compile_latex_project.py` to detect engine, bibliography tool, and required passes.
   - Use `scripts/audit_latex_project.py` when a project is messy, incomplete, or failing unexpectedly.
   - Fix root causes in structure, package selection, missing files, or bibliography config instead of layering hacks.

6. Deliver a submission-ready result.
   - Check warnings, broken references, missing figures, missing bibliography entries, and obvious layout regressions.
   - Call out any venue-specific assumptions, engine requirements, or external dependencies.
   - Keep final recommendations practical: what is ready, what is risky, and what still needs manual review.

## Reference Guide

| Topic | Reference | Load when |
|---|---|---|
| Template selection and project setup | `references/document-types-and-project-setup.md` | Choosing article/report/thesis/book/Beamer/poster/resume structure |
| Preambles, macros, and structure | `references/preambles-macros-and-structure.md` | Organizing the preamble, custom commands, theorem styles, and modular file layout |
| Math, figures, tables, and TikZ | `references/math-figures-tables-and-tikz.md` | Equations, aligned math, plots, figures, tables, and diagrams |
| Bibliography, cross-references, and indexes | `references/bibliography-crossrefs-and-indexes.md` | BibTeX vs biber, citations, labels, glossary/index workflows, and cross-reference hygiene |
| Beamer, posters, and presentations | `references/beamer-posters-and-presentations.md` | Slides, posters, overlays, column layouts, and presentation-specific constraints |
| Build, lint, and troubleshooting | `references/build-lint-and-troubleshooting.md` | Engine selection, multi-pass builds, latexmk, common errors, and debugging |
| Submission, collaboration, and publishing | `references/submission-collaboration-and-publishing.md` | Journal/conference readiness, diff workflows, collaboration, and release artifacts |

## Bundled Scripts

- `scripts/bootstrap_latex_project.py`
  - Scaffold a structured LaTeX project from built-in templates for article, report, thesis, Beamer, poster, resume, and specialized green engineering-report variants.
  - Generates `main.tex`, optional bibliography, optional `latexmkrc`, and starter folders for sections, figures, and tables.
  - Use when starting a new document or standardizing a weak repository.

- `scripts/compile_latex_project.py`
  - Detect engine and bibliography workflow, build an execution plan, and optionally run compilation passes.
  - Explains common `.log` errors in plain language and supports `--dry-run` for safe planning.
  - Use before final delivery or whenever the project fails to compile.

- `scripts/audit_latex_project.py`
  - Inspect a LaTeX repo for missing inputs, broken graphics, missing bibliography keys, risky package choices, and build gaps.
  - Use early in large cleanups, handoffs, and debugging sessions.

- `scripts/csv_to_latex_table.py`
  - Convert CSV data into `booktabs` or `longtable` LaTeX tables with caption, label, and alignment options.
  - Use for reports, papers, appendices, and reproducible table generation.

## Assets

- `assets/templates/article/main.tex`
- `assets/templates/report/main.tex`
- `assets/templates/thesis/main.tex`
- `assets/templates/beamer/main.tex`
- `assets/templates/poster/main.tex`
- `assets/templates/resume/main.tex`
- `assets/templates/_shared/green-report/engreportgreen.sty`
- `assets/templates/lab-report-green/main.tex`
- `assets/templates/test-report-green/main.tex`
- `assets/templates/validation-report-green/main.tex`
- `assets/templates/design-report-green/main.tex`
- `assets/templates/failure-analysis-green/main.tex`

Use these as stable starting points rather than improvising a preamble from scratch.

## Constraints

### MUST DO

- Match the document class, engine, and bibliography tool to the actual output needs.
- Keep labels, citations, file includes, and graphics paths consistent and verifiable.
- Prefer semantic structure over manual spacing hacks.
- Use publication-safe packages and explain any non-standard dependency.
- Separate content and assets cleanly for multi-file projects.
- State what was validated and what still depends on a local TeX installation or venue template.

### MUST NOT DO

- Patch LaTeX layout problems with repeated `\\`, `\vspace`, or magic spacing unless there is a real layout reason.
- Mix BibTeX and biber assumptions casually in the same project.
- Add packages blindly to silence errors without checking compatibility.
- Leave broken `\ref{}`, `\cite{}`, `\input{}`, or `\includegraphics{}` references unresolved.
- Recommend a heavy or exotic package stack when a simpler solution is enough.
- Claim a document is submission-ready without checking compilation flow and reference integrity.

## Output Template

For non-trivial LaTeX tasks, provide:

1. Document goal and chosen structure.
2. Preamble, engine, and package decisions.
3. Content organization changes.
4. Build/debugging steps run or recommended.
5. Remaining risks, submission notes, or manual follow-up.

## Primary References

- [LaTeX Project](https://www.latex-project.org/)
- [CTAN](https://ctan.org/)
- [Overleaf Learn LaTeX](https://www.overleaf.com/learn)
- [TikZ and PGF Manual](https://ctan.org/pkg/pgf)
- [biblatex Documentation](https://ctan.org/pkg/biblatex)
- [latexmk Documentation](https://ctan.org/pkg/latexmk)
