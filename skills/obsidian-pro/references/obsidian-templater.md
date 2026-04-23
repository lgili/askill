# Obsidian Templater

> Reference for: obsidian-pro
> Load when: Working with obsidian templater

## Overview

The Templater plugin is a powerful tool for creating and using templates in Obsidian. It allows you to automate the creation of notes and insert dynamic content into your notes.

## Key Concepts

- **Template**: A note that contains special syntax that gets replaced with dynamic content when the template is inserted.
- **Template Tags**: Special tags that are used to define dynamic content in your templates. The most common are `<%` and `%>`.
- **User Functions**: You can define your own JavaScript functions to use in your templates.
- **System Commands**: Templater provides a set of system commands that you can use to interact with Obsidian and the filesystem.

## Examples

### Creating a simple template

Create a new note in your templates folder with the following content:

```markdown
---
creation_date: <% tp.file.creation_date() %>
---

# <% tp.file.title %>

Hello, world!
```

When you create a new note from this template, the frontmatter will be populated with the creation date and the title of the note will be inserted as a heading.

### Using a user function

You can define a user function in your settings to get a random quote:

```javascript
function randomQuote() {
  const quotes = ["Quote 1", "Quote 2", "Quote 3"];
  return quotes[Math.floor(Math.random() * quotes.length)];
}
```

Then you can use it in your template:

```markdown
Quote of the day: <% randomQuote() %>
```

## Anti-Patterns

- **Overly complex templates**: Keep your templates as simple as possible. Complex templates can be difficult to debug and maintain.
- **Not using user functions for complex logic**: If you have complex logic in your templates, move it to a user function.
- **Hardcoding values**: Use dynamic content whenever possible.
- **Not using the documentation**: The Templater plugin is very powerful and has excellent documentation. Make sure to read it.
