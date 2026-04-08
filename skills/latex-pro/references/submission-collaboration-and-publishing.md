# Submission, Collaboration, and Publishing

> Reference for: latex-pro
> Load when: preparing final PDFs, collaborating on drafts, diffing changes, or shipping venue-ready artifacts

## Submission Mindset

A document is not ready because it compiles once. It is ready when:

- the right class/template is used
- citations and references resolve
- required figures and tables are present
- layout is acceptable for the target venue
- engine and bibliography assumptions are documented

## Venue Safety

Before final submission:

- re-check page limits
- verify anonymous review rules
- confirm bibliography style
- confirm accepted font/image/tooling restrictions
- test with the actual venue class if one exists

## Collaboration

For team-maintained LaTeX:

- prefer one stable main file
- keep sections in separate files
- agree on citation key naming
- avoid package churn in late stages
- use clear macros instead of personal shorthand that only one author understands

## Diff and Review

For substantial revisions:

- keep source diffs reviewable
- consider `latexdiff` when source changes need PDF review
- separate structural, content, and bibliography changes when possible

## Build Artifacts

Be explicit about what should be committed:

- source `.tex`, `.bib`, figures, templates, config
- optionally checked-in generated figures if reproducibility depends on them
- usually not `.aux`, `.log`, `.toc`, `.out`, `.bbl` unless the workflow explicitly requires them

## Final Deliverables

Common deliverables:

- PDF
- source archive
- bibliography file
- figures/data appendix
- poster/slides companion PDF

If the user needs archival stability, mention:

- exact engine used
- bibliography backend
- required external packages or class files
- whether the build was actually run locally or only statically reviewed

## Resume and Business Document Notes

- PDF text extraction matters
- unusual fonts and heavy graphic layouts may hurt downstream parsing
- keep machine-readable output in mind for ATS-style flows

## Pre-Release Checklist

- all citations resolve
- all labels resolve
- all required figures exist
- venue template still intact
- no obvious overfull/underfull disasters in critical pages
- build instructions are known and repeatable
