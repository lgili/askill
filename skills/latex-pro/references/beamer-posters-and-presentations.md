# Beamer, Posters, and Presentations

> Reference for: latex-pro
> Load when: building slides, posters, talk material, or visually constrained presentation documents

## Beamer Principles

- Slides are not papers with bigger fonts.
- One idea per slide is usually the right default.
- Use overlays only when they genuinely improve explanation flow.
- Keep source manageable; avoid hand-tuned chaos in every frame.

Recommended frame types:

- title / agenda
- concept explanation
- equation or derivation
- comparison table
- figure-driven slide
- two-column discussion
- conclusion / takeaway

## Beamer Package Discipline

Commonly useful:

- `graphicx`
- `booktabs`
- `tikz`
- `appendixnumberbeamer`
- `siunitx`

Be careful with:

- heavy package stacks copied from article templates
- bibliography packages without a clear plan for slide references
- theme customizations that become impossible to maintain

## Poster Principles

- lead with one central finding or message
- use large typography and short text blocks
- prefer visual hierarchy over completeness
- validate actual physical size and orientation early

Poster sections typically include:

- title and authors
- motivation
- method
- key results
- takeaways
- QR code or contact block

## Layout Guidance

For Beamer:

- consistent block spacing matters more than decoration
- dense equations may need reveal sequencing or appendix slides
- prefer readable contrast over theme novelty

For posters:

- keep line lengths short
- use 2 to 4 visual columns depending on poster class and size
- large figures beat dense prose
- avoid tiny bibliography text walls when a QR code to the paper is better

## Figures in Presentation Media

- export charts and diagrams in a size appropriate to the medium
- do not reuse paper figures unchanged if labels become unreadable
- consider simplifying legends and annotations for slides/posters

## Animation and Overlays

Use overlays to reveal:

- steps in an argument
- incremental diagram construction
- table row emphasis

Avoid overlays when they:

- create brittle frame logic
- make the source unreadable
- would be better handled by a second slide

## Review Checklist

- Is the core message obvious within seconds?
- Are figures legible at presentation scale?
- Are slide/poster sections visually balanced?
- Are overlays necessary and maintainable?
- Does the final artifact match the actual presentation context?
