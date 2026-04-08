# Build, Lint, and Troubleshooting

> Reference for: latex-pro
> Load when: choosing compile commands, debugging errors, setting `latexmk`, or stabilizing a broken build

## Build Strategy

Prefer reproducible commands over ad hoc editor buttons.

Common workflows:

- direct engine call for small documents
- `latexmk` for iterative authoring
- explicit multi-pass builds when debugging citations, indexes, or glossaries

## Engine Detection Heuristics

Good signals:

- `% !TEX program = xelatex`
- `\usepackage{xeCJK}` or `\setCJKmainfont` -> `xelatex`
- `\usepackage{luacode}` or `\directlua` -> `lualatex`
- `\usepackage{fontspec}` -> usually `xelatex` or `lualatex`
- otherwise -> often `pdflatex`

## Multi-Pass Reality

Many documents need more than one pass:

1. first LaTeX run creates aux data
2. BibTeX or biber may run
3. makeindex or makeglossaries may run
4. one or more additional LaTeX passes resolve references

Do not stop after the first successful engine run and assume the document is correct.

## Common Error Translation

`Missing $ inserted`

- a math-only command appeared outside math mode
- wrap the expression in `$...$` or move the command into a proper environment

`Undefined control sequence`

- package missing
- typo in a command
- wrong engine for the chosen package stack

`File ... not found`

- missing graphic, bibliography, included file, or wrong relative path
- check `\input`, `\includegraphics`, and bibliography filenames

`Citation ... undefined`

- key missing from `.bib`
- bibliography tool did not run
- wrong backend

`Reference ... undefined`

- label missing
- wrong label name
- more build passes needed

## latexmk

`latexmk` is the best default for iterative work when available.

Typical config:

```perl
$pdf_mode = 1;
$pdflatex = 'pdflatex -interaction=nonstopmode -file-line-error %O %S';
$xelatex = 'xelatex -interaction=nonstopmode -file-line-error %O %S';
$lualatex = 'lualatex -interaction=nonstopmode -file-line-error %O %S';
```

Prefer checking in `latexmkrc` when the repo has a stable build policy.

## Troubleshooting Order

1. confirm main file and engine
2. inspect includes and graphic paths
3. inspect bibliography setup
4. rerun correct multi-pass sequence
5. parse the `.log` with focused attention on the first real error
6. clean stale build artifacts only if the build state is clearly inconsistent

## Linting and Quality

Useful tools:

- `chktex` for stylistic and common LaTeX mistakes
- `latexmk` for stable builds
- targeted scripts that inspect missing inputs and unresolved citations

Linting is helpful, but compilation correctness comes first.

## Anti-Patterns

- adding random packages until the error disappears
- forcing layout with repeated spacing hacks
- switching engines without understanding why
- ignoring warnings about undefined citations or references
- editing generated auxiliary files manually
