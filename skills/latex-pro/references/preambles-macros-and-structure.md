# Preambles, Macros, and Structure

> Reference for: latex-pro
> Load when: building or cleaning a preamble, defining commands, splitting files, or stabilizing formatting

## Preamble Design Principles

- Add packages intentionally, not by superstition.
- Group packages by concern: encoding/fonts, language, math, graphics, tables, bibliography, utilities.
- Avoid redundant packages with overlapping responsibilities unless the combination is known to work.
- Keep comments around non-obvious package choices and compatibility constraints.

Suggested ordering:

1. document class
2. language/font/input setup
3. page geometry and typography
4. math and theorem packages
5. graphics and floats
6. table/data packages
7. bibliography/cross-reference packages
8. custom macros and theorem environments

## Safe Core Package Set

For many documents, a compact baseline looks like:

```tex
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{lmodern}
\usepackage{microtype}
\usepackage{geometry}
\usepackage{graphicx}
\usepackage{amsmath,amssymb,mathtools}
\usepackage{booktabs}
\usepackage{hyperref}
\usepackage[capitalise,nameinlink]{cleveref}
```

For XeLaTeX/LuaLaTeX, replace legacy font setup with `fontspec` and remove `inputenc`.

## Macro Design

Macros should reduce repetition and improve semantic consistency, not obscure the document.

Good:

```tex
\newcommand{\R}{\mathbb{R}}
\newcommand{\vect}[1]{\boldsymbol{#1}}
\DeclareMathOperator{\Var}{Var}
```

Risky:

```tex
\newcommand{\s}{\smallskip}
\newcommand{\x}[1]{\textcolor{red}{#1}}
\newcommand{\mymacroA}[2][foo]{...}
```

Guidelines:

- Prefer semantic macros for repeated notation and domain-specific constructs.
- Avoid redefining standard commands unless absolutely necessary.
- Keep authoring/debugging helpers separate from permanent semantic macros.
- Namespace large macro collections with consistent prefixes in big projects.

## Theorem and Proof Structure

For mathematical or formal documents:

- define theorem-like environments once in the preamble
- keep numbering policy consistent
- use `cleveref` for references to theorem environments
- avoid ad hoc bold labels inside paragraphs when formal environments are better

Example:

```tex
\usepackage{amsthm}

\newtheorem{theorem}{Theorem}[section]
\newtheorem{lemma}[theorem]{Lemma}
\theoremstyle{definition}
\newtheorem{definition}[theorem]{Definition}
\theoremstyle{remark}
\newtheorem{remark}[theorem]{Remark}
```

## Multi-File Documents

Use `\input{}` for lightweight inclusion and `\include{}` when chapter-style pagination and `\includeonly` behavior help.

Typical pattern:

```tex
\input{sections/introduction}
\input{sections/methods}
\input{sections/results}
\input{sections/conclusion}
```

Keep relative paths stable and predictable. Avoid deep nesting without a real reason.

## Layout Hygiene

Prefer:

- sectioning commands
- list environments
- `table`/`figure` with captions and labels
- paragraph spacing defined once

Avoid:

- repeated `\\` for layout
- manual line breaks inside prose
- arbitrary `\vspace` to force pages unless you understand the side effects
- per-paragraph formatting overrides that should be global style decisions

## Hyperlinks and References

Keep `hyperref` near the end of the package list. Add `cleveref` after it if used.

Recommended:

```tex
\usepackage[hidelinks]{hyperref}
\usepackage[capitalise,nameinlink]{cleveref}
```

## Cleanup Checklist

- Remove unused packages
- Remove duplicated macros
- Standardize theorem and reference style
- Replace visual hacks with structural fixes
- Move repeated content patterns into commands or environments only when they truly repeat
