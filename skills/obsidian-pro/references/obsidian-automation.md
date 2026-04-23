# Obsidian Automation

> Reference for: obsidian-pro
> Load when: Working with obsidian automation

## Overview

This document provides guidance on automating tasks and workflows in Obsidian. By combining the power of plugins like Dataview and Templater, you can create a highly efficient and personalized knowledge management system.

## Key Concepts

- **Workflow Automation**: The process of creating a system that automatically performs a series of tasks that you would otherwise do manually.
- **Combining Plugins**: The real power of automation in Obsidian comes from combining plugins. For example, you can use a Templater template to create a new note with a Dataview query already in it.
- **External Tools**: You can also use external tools to automate tasks in Obsidian. For example, you can use a script to automatically add notes to your vault or to process existing notes.

## Examples

### Creating a daily note with a list of today's tasks

This example uses the Templater and Dataview plugins.

1.  **Create a template** for your daily note:

    ```markdown
    ---
    tags: daily-note
    date: <% tp.file.creation_date("YYYY-MM-DD") %>
    ---

    # Daily Note - <% tp.file.creation_date("dddd, MMMM Do YYYY") %>

    ## Tasks for today

    ```dataview
    TASK
    WHERE dueDate = date("<% tp.file.creation_date("YYYY-MM-DD") %>")
    ```
    ```

2.  **Configure the Templater plugin** to use this template for new daily notes.

Now, when you create a new daily note, it will automatically be populated with the current date and a list of tasks due on that day.

### Using an external script to create a new note

This example uses a simple shell script to create a new note in your vault.

```bash
#!/bin/bash

VAULT_PATH="/path/to/your/vault"
NOTE_TITLE="New note from script"
NOTE_CONTENT="This note was created from a script."

echo "$NOTE_CONTENT" > "$VAULT_PATH/$NOTE_TITLE.md"
```

## Anti-Patterns

- **Automating everything**: Don't try to automate everything. Some tasks are better done manually.
- **Creating complex systems that you don't understand**: If you don't understand how your automation works, you won't be able to fix it when it breaks.
- **Not documenting your automation**: If you create a complex automation, make sure to document how it works so that you can remember it later.
- **Ignoring security**: If you are using external scripts, make sure that they are not doing anything malicious.
