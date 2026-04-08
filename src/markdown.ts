function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInlineMarkdown(value: string): string {
  let html = escapeHtml(value);
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_match, label: string, url: string) => {
    const safeLabel = escapeHtml(label);
    const safeUrl = escapeHtml(url);
    return `<a href="${safeUrl}" target="_blank" rel="noreferrer noopener">${safeLabel}</a>`;
  });
  html = html.replace(/`([^`]+)`/g, (_match, code: string) => `<code>${escapeHtml(code)}</code>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return html;
}

function flushParagraph(paragraph: string[], html: string[]): void {
  if (paragraph.length === 0) {
    return;
  }
  html.push(`<p>${paragraph.map((line) => renderInlineMarkdown(line)).join("<br>")}</p>`);
  paragraph.length = 0;
}

function closeList(currentList: { type: "ul" | "ol" | null }, html: string[]): void {
  if (currentList.type) {
    html.push(`</${currentList.type}>`);
    currentList.type = null;
  }
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return false;
  }
  return trimmed
    .slice(1, -1)
    .split("|")
    .every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((cell) => renderInlineMarkdown(cell.trim()));
}

function consumeTable(lines: string[], startIndex: number): { html: string; nextIndex: number } | null {
  const headerLine = lines[startIndex]?.trim();
  const separatorLine = lines[startIndex + 1]?.trim();
  if (!headerLine || !separatorLine || !headerLine.startsWith("|") || !headerLine.endsWith("|") || !isTableSeparator(separatorLine)) {
    return null;
  }

  const headers = splitTableRow(headerLine);
  const rows: string[][] = [];
  let index = startIndex + 2;
  while (index < lines.length) {
    const candidate = lines[index]?.trim();
    if (!candidate || !candidate.startsWith("|") || !candidate.endsWith("|")) {
      break;
    }
    rows.push(splitTableRow(candidate));
    index += 1;
  }

  const html = [
    "<div class=\"markdown-table-wrap\">",
    "<table>",
    "<thead>",
    "<tr>",
    ...headers.map((header) => `<th>${header}</th>`),
    "</tr>",
    "</thead>",
    "<tbody>",
    ...rows.map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`,
    ),
    "</tbody>",
    "</table>",
    "</div>",
  ].join("");

  return {
    html,
    nextIndex: index - 1,
  };
}

/**
 * Renders a safe HTML representation for common Markdown constructs used by skills.
 *
 * @param markdown - Raw markdown source.
 * @returns Sanitized HTML string.
 */
export function renderMarkdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  const paragraph: string[] = [];
  const currentList: { type: "ul" | "ol" | null } = { type: null };
  let inCodeFence = false;
  let codeFenceLanguage = "";
  const codeFenceLines: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushParagraph(paragraph, html);
      closeList(currentList, html);
      if (inCodeFence) {
        const languageClass = codeFenceLanguage ? ` class="language-${escapeHtml(codeFenceLanguage)}"` : "";
        html.push(
          `<pre><code${languageClass}>${escapeHtml(codeFenceLines.join("\n"))}</code></pre>`,
        );
        codeFenceLines.length = 0;
        codeFenceLanguage = "";
        inCodeFence = false;
      } else {
        inCodeFence = true;
        codeFenceLanguage = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeFence) {
      codeFenceLines.push(line);
      continue;
    }

    const table = consumeTable(lines, index);
    if (table) {
      flushParagraph(paragraph, html);
      closeList(currentList, html);
      html.push(table.html);
      index = table.nextIndex;
      continue;
    }

    if (!trimmed) {
      flushParagraph(paragraph, html);
      closeList(currentList, html);
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph(paragraph, html);
      closeList(currentList, html);
      const level = headingMatch[1]?.length ?? 1;
      html.push(`<h${level}>${renderInlineMarkdown(headingMatch[2] ?? "")}</h${level}>`);
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph(paragraph, html);
      if (currentList.type !== "ul") {
        closeList(currentList, html);
        currentList.type = "ul";
        html.push("<ul>");
      }
      html.push(`<li>${renderInlineMarkdown(unorderedMatch[1] ?? "")}</li>`);
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph(paragraph, html);
      if (currentList.type !== "ol") {
        closeList(currentList, html);
        currentList.type = "ol";
        html.push("<ol>");
      }
      html.push(`<li>${renderInlineMarkdown(orderedMatch[1] ?? "")}</li>`);
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph(paragraph, html);
      closeList(currentList, html);
      const quoteLines = [renderInlineMarkdown(quoteMatch[1] ?? "")];
      while (index + 1 < lines.length) {
        const next = lines[index + 1]?.trim() ?? "";
        const nextQuote = next.match(/^>\s?(.*)$/);
        if (!nextQuote) {
          break;
        }
        quoteLines.push(renderInlineMarkdown(nextQuote[1] ?? ""));
        index += 1;
      }
      html.push(`<blockquote><p>${quoteLines.join("<br>")}</p></blockquote>`);
      continue;
    }

    paragraph.push(trimmed);
  }

  if (inCodeFence) {
    const languageClass = codeFenceLanguage ? ` class="language-${escapeHtml(codeFenceLanguage)}"` : "";
    html.push(`<pre><code${languageClass}>${escapeHtml(codeFenceLines.join("\n"))}</code></pre>`);
  }

  flushParagraph(paragraph, html);
  closeList(currentList, html);
  return html.join("\n");
}
