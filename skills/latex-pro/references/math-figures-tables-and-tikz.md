# Math, Figures, Tables, and TikZ

> Reference for: latex-pro
> Load when: formatting equations, tables, figures, plots, diagrams, or visual-heavy academic content

## Math

Prefer structured math environments over inline hacks:

- `equation`, `align`, `gather`, `multline` for displayed math
- `cases` for piecewise definitions
- `split` inside `equation` when a single numbered expression spans lines

Prefer:

```tex
\begin{align}
f(x) &= x^2 + 1 \\
f'(x) &= 2x
\end{align}
```

Over:

```tex
$$ f(x)=x^2+1 \\ f'(x)=2x $$
```

Guidelines:

- Use `\left`/`\right` sparingly; they often oversize delimiters
- Prefer semantic operators via `\DeclareMathOperator`
- Keep notation consistent across chapters and appendices

## Figures

Use `graphicx` and stable relative paths:

```tex
\begin{figure}[htbp]
  \centering
  \includegraphics[width=0.8\linewidth]{figures/architecture.pdf}
  \caption{System architecture.}
  \label{fig:architecture}
\end{figure}
```

Guidelines:

- Prefer vector formats (`pdf`, `svg` converted appropriately) for line art
- Prefer `png`/`jpg` for raster imagery
- Put `\label` after `\caption`
- Keep captions descriptive, not essay-length

## Tables

Use `booktabs` for publication-style rules:

```tex
\begin{table}[htbp]
  \centering
  \begin{tabular}{lrr}
    \toprule
    Model & Accuracy & Latency \\
    \midrule
    Baseline & 0.81 & 42 \\
    Proposed & 0.87 & 39 \\
    \bottomrule
  \end{tabular}
  \caption{Validation results.}
  \label{tab:results}
\end{table}
```

Guidelines:

- Avoid vertical rules unless a house style requires them
- Use `siunitx` to align numbers
- Use `longtable` when the table spans multiple pages
- Generate repetitive tables from data rather than hand-editing large tabular blocks

## TikZ and Diagrams

Use TikZ when:

- the diagram must match document fonts and style
- the graphic is simple enough to maintain in source form
- labels and mathematical notation matter

Avoid TikZ when:

- the diagram is extremely detailed or design-heavy
- the source becomes harder to maintain than a stable external figure

Keep styles centralized:

```tex
\tikzset{
  block/.style={draw, rounded corners, align=center, minimum height=2.4em},
  arrow/.style={->, thick}
}
```

## pgfplots

Use `pgfplots` for plots that should stay version-controlled and text-consistent.

Good use cases:

- line plots
- bar charts
- scatter plots
- ablation studies
- benchmark comparisons

For heavy data or repeated reporting, generate tables externally and feed them into TeX rather than hardcoding raw data.

## Float Strategy

Default placement:

- `[htbp]` for most figures and tables
- use `H` only when the layout truly must be pinned and the document already uses `float`

Do not fight TeX blindly. If floats drift badly:

- reduce float size
- improve section placement
- split giant figures/tables
- use a better page design rather than stacking spacing hacks

## Review Checklist

- Are equations readable and aligned?
- Are all figures and tables labeled and referenced?
- Are captions precise and useful?
- Are numeric columns aligned consistently?
- Is TikZ the right tool, or should the figure live outside TeX?
