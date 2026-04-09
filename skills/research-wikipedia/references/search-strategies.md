# Search and Disambiguation Strategies

## Choosing the Right Search Mode

| Situation | Strategy |
|---|---|
| Exact article title known | Direct `summary` endpoint |
| Topic name uncertain / ambiguous | `opensearch` → pick from suggestions |
| Scientific or technical term | Search then verify via `description` field |
| Person's name | Add "physicist", "politician", etc. to disambiguate |
| Geographic name used in multiple countries | Add country/context to query |

## Disambiguation Pages

A disambiguation page exists when a term has multiple meanings (e.g., "Mars" = planet, Roman god, chocolate bar, music band, etc.).

Detect a disambiguation page:
- REST API summary: `type` field = `"disambiguation"` (check `extract` or `type` key).
- The extract text typically starts with: *"X may refer to:"*.

Resolution strategy:
1. Run `--mode search` with the ambiguous term.
2. Inspect descriptions returned.
3. Select the result whose `description` matches your intent.
4. Re-run with the exact canonical title.

## Redirect Handling

Wikipedia titles are case-sensitive. The REST API follows redirects automatically.

- `"alan turing"` → automatically redirects to `"Alan Turing"`.
- `"U.S."` → redirects to `"United States"`.

If a summary returns unexpectedly unrelated content, check whether a redirect chain has led to the wrong article. Use the `title` field in the response to confirm the resolved title.

## Multi-word and Special Character Titles

- Encode spaces as `_` or `%20`. The `wikipedia_search.py` script handles this automatically.
- Apostrophes in titles (e.g., "D'Artagnan") must be URL-encoded: `D%27Artagnan`.
- Titles with slashes (e.g., "AC/DC") are URL-encoded: `AC%2FDC`.

## Language Selection

When researching region-specific or language-specific topics, the local-language Wikipedia may have richer content:

| Domain | Language |
|---|---|
| `pt.wikipedia.org` | Brazilian/Portuguese content |
| `de.wikipedia.org` | German engineering standards (DIN, VDE) |
| `ja.wikipedia.org` | Japanese technical standards |
| `es.wikipedia.org` | Latin American political topics |

Use `--lang pt` flag in the script to switch to Brazilian Portuguese Wikipedia.

## Search Quality Tips

- **Too many results / too broad:** Add a parenthetical qualification, e.g., `Mercury (planet)` not just `Mercury`.
- **No results:** Try the singular form, or reverse the word order.
- **Stale info worry:** Check `lastrevid` and the article's "last edited" timestamp.
- **Searching for a concept inside an article:** Use `--mode sections` and scan section titles for the relevant heading.
