# Bibliography, Cross-References, and Indexes

> Reference for: latex-pro
> Load when: citations break, bibliography tooling is unclear, or indexes/glossaries cross-reference workflows matter

## BibTeX vs biber

Use BibTeX when:

- the venue template explicitly requires it
- the style is tied to older `.bst` workflows
- compatibility matters more than feature richness

Use biber with `biblatex` when:

- you control the bibliography setup
- you need stronger multilingual or field-customization support
- you want a modern citation workflow

Do not mix both assumptions casually.

## Typical Configurations

BibTeX:

```tex
\bibliographystyle{plainnat}
\bibliography{references}
```

`biblatex` + biber:

```tex
\usepackage[
  backend=biber,
  style=authoryear
]{biblatex}
\addbibresource{references.bib}
```

## Citation Hygiene

- every `\cite{}` key should exist in a `.bib` file
- every bibliography entry should use stable, readable keys
- repeated citation styles should be consistent across the document
- do not manually format references inside body text when they belong in the bibliography system

Suggested key shape:

- `AuthorYearKeyword`
- `AuthorAuthorYearShortTopic`

Avoid keys like `ref1`, `paper2`, or random hashes unless machine-generated with a clear reason.

## Labels and Cross-References

Use labels consistently:

- `sec:introduction`
- `fig:architecture`
- `tab:results`
- `eq:loss`
- `thm:main-result`

Prefer `cleveref` for human-readable references:

```tex
As shown in \cref{fig:architecture,tab:results}, ...
```

## Indexes and Glossaries

Use indexes or glossaries only when the document size justifies them:

- theses
- books
- manuals
- symbol-heavy lecture notes

Signals that they help:

- many repeated terms or symbols
- readers need non-linear navigation
- appendices or notation tables are not enough

Remember the build implications:

- indexes typically require `makeindex`
- glossaries often require `makeglossaries`

## Common Failure Modes

- citations unresolved because biber/BibTeX never ran
- `.bib` filename mismatch
- wrong backend for the package configuration
- labels defined before captions or on the wrong object
- stale auxiliary files after bibliography backend changes

## Practical Debug Order

1. inspect bibliography declarations in `main.tex`
2. confirm `.bib` file path exists
3. check whether the project expects BibTeX or biber
4. inspect the `.blg`, `.bcf`, or `.aux` files if present
5. rerun the correct multi-pass build

## Checklist

- All citation keys resolve
- No "undefined references" warnings remain
- Label naming is consistent
- Bibliography backend matches the document configuration
- Index/glossary tooling is declared only when actually used
