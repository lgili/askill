# Obsidian Dataview

> Reference for: obsidian-pro
> Load when: Working with obsidian dataview

## Overview

The Dataview plugin is a powerful tool for querying and displaying data from your Obsidian vault. It allows you to treat your vault as a database and retrieve information based on metadata, tags, and other criteria.

## Key Concepts

- **Dataview Query**: A special code block that allows you to query your vault data.
- **Data Commands**: `LIST`, `TABLE`, `TASK`, and `CALENDAR` are the four main data commands to display data.
- **Data Sources**: You can query data from pages, tags, and folders.
- **Fields**: You can add metadata to your notes using YAML frontmatter or inline fields. This metadata can then be used in your Dataview queries.

## Examples

### Listing all notes with a specific tag

```dataview
LIST
FROM #books 
```

### Creating a table of books with their authors and ratings

```dataview
TABLE author, rating
FROM #books 
```

### Listing all incomplete tasks

```dataview
TASK
WHERE !completed
```

### Using inline fields

You can add fields directly into your notes like this: `Key:: Value`. For example: `Author:: [[George Orwell]]`.

Then you can query this data:

```dataview
TABLE author
FROM #books
```

## Anti-Patterns

- **Over-reliance on Dataview**: Don't use Dataview for everything. Sometimes, a simple link or a tag is enough.
- **Complex queries**: Keep your queries as simple as possible. Complex queries can be slow and difficult to maintain.
- **Not using metadata**: Dataview is most powerful when you have consistent metadata in your notes.
- **Forgetting to enable the plugin**: Make sure you have enabled the Dataview plugin in the Obsidian settings.
