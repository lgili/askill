# Document Types and Project Setup

> Reference for: latex-pro
> Load when: choosing a document class, template shape, folder structure, or engine defaults

## Choose the Simplest Viable Document Type

- `article`: papers, short reports, technical notes, handouts, whitepapers
- `report`: longer reports with chapters or heavier front matter
- `book`: books, manuals, lecture notes, long-form academic work
- `beamer`: talks, lectures, demos, workshops
- `tikzposter` or poster-specific classes: research posters and visual summaries
- resume/CV templates: job application documents with tighter layout constraints

Do not use `book` when `article` is enough. Do not use a poster class for a slide deck.

## Single-File vs Multi-File

Use a single file for:

- short articles
- small assignments
- one-page resumes
- quick internal notes

Use multi-file structure for:

- theses and books
- reports with many sections
- multi-author papers
- slide decks with appendices
- projects with figures, tables, data, and bibliography assets

Recommended project layout:

```text
main.tex
references.bib
latexmkrc
sections/
figures/
tables/
build/
```

For larger projects:

```text
main.tex
frontmatter/
sections/
appendices/
figures/
tables/
bibliography/
```

## Engine Selection

Default to:

- `pdflatex` for portability and conservative package stacks
- `xelatex` for system fonts, multilingual work, or `fontspec` + `xeCJK`
- `lualatex` when Lua-specific packages or modern font workflows need it

Heuristics:

- `fontspec` alone usually suggests `xelatex` or `lualatex`
- `xeCJK` strongly suggests `xelatex`
- `luacode` or `\directlua` suggests `lualatex`
- venue templates often force the engine; obey the class/template rules first

## Venue and Submission Constraints

Before touching layout, ask:

- Is there an official `.cls` or `.sty` file?
- Is the bibliography style mandatory?
- Are page limits hard?
- Does the publisher require PDF/A, arXiv compatibility, or anonymous review?
- Are there restrictions on fonts, image formats, or shell escape?

If the venue provides a template, preserve it and layer minimal changes on top.

## Starter Rules by Document Type

### Academic Paper

- Prefer `article` or the venue class
- Keep abstract, sections, figures, tables, and references cleanly separated
- Use `cleveref`, `booktabs`, `siunitx`, and consistent theorem styles only when appropriate
- Avoid package sprawl in submission templates

### Thesis

- Use multi-file structure
- Keep front matter separate from chapters
- Plan for bibliography, appendices, glossary/index, and figure-heavy chapters
- Decide early whether the university template controls typography

### Report

- Use `report` when chapters or appendices matter
- Structure around executive summary, background, findings, recommendations, appendices
- Prefer stable tables and reproducible figures over hand-tuned layout

### Beamer

- Keep one idea per slide
- Minimize dense paragraphs
- Decide early whether the deck is live-speaking material or standalone reading material

### Poster

- Visual hierarchy matters more than prose completeness
- Limit text blocks aggressively
- Choose one central figure or key result
- Validate final paper size and orientation before polishing design

### Resume / CV

- Keep source compact and easy to update
- Avoid layout tricks that create unreadable copy/paste output
- Separate reusable macros from content if the document changes often

## Practical Setup Checklist

- Pick document type and engine
- Decide single-file or multi-file
- Add figures/tables/bibliography folders if the scope justifies them
- Set `latexmkrc` or build command defaults early
- Keep a stable main file name (`main.tex`) unless a venue template requires otherwise
