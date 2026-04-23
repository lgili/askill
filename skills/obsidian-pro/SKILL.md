---
name: "Obsidian Pro"
description: "A powerful skill to help you use Obsidian. It helps you to manage your notes, tasks, and knowledge. Activates when you say 'obsidian', 'obsidian pro', or 'obsidian skill'."
---

# Obsidian Pro

A powerful skill to help you use Obsidian. It helps you to manage your notes, tasks, and knowledge. Activates when you say 'obsidian', 'obsidian pro', or 'obsidian skill'.

## Core Workflow

1. **Understand the Goal** - Identify the user's primary objective (e.g., creating a new note, querying data, automating a workflow).
2. **Deconstruct the Request** - Break down the user's request into smaller, manageable steps.
3. **Select the Right Tools** - Based on the request, determine the appropriate Obsidian features or plugins to use (e.g., Dataview, Templater).
4. **Load Relevant Knowledge** - Consult the Reference Guide for best practices and examples related to the selected tools.
5. **Formulate the Solution** - Construct a clear, step-by-step solution for the user.
6. **Generate the Output** - Present the solution in a structured and easy-to-understand format, following the Output Template.
7. **Include Explanations** - Briefly explain the 'why' behind the solution, helping the user learn.

## Reference Guide

| Topic | Reference | When to load |
|-------|-----------|--------------|
| Obsidian Basics | `references/obsidian-basics.md` | For fundamental concepts and features of Obsidian. |
| Dataview Plugin | `references/obsidian-dataview.md` | When the user wants to query and display data from their notes. |
| Templater Plugin | `references/obsidian-templater.md` | For creating and using templates to automate note creation. |
| Automation | `references/obsidian-automation.md` | For advanced workflows and automating tasks within Obsidian. |

## Bundled Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/validate-dataview-query.js` | Validates the syntax of a Dataview query. | `node skills/obsidian-pro/scripts/validate-dataview-query.js --query "..."` |

## Constraints

**MUST DO**
- Provide clear and concise explanations.
- Use code blocks for all queries, scripts, and templates.
- Link to the official Obsidian documentation when introducing a new concept.
- Prioritize solutions that use core Obsidian features before suggesting plugins.

**MUST NOT DO**
- Do not suggest complex workflows for simple tasks.
- Do not provide solutions without explaining how they work.
- Do not recommend unofficial or deprecated plugins without a clear warning.
- Do not modify the user's vault without explicit permission.

## Output Template

When providing a solution, use the following structure:

### Objective
*A brief description of what the solution achieves.*

### Tools Used
*A list of Obsidian features or plugins required for the solution.*

### Steps
1. *Clear, step-by-step instructions.*
2. *Use numbered lists for sequences of actions.*
3. *Use bullet points for non-sequential options or notes.*

### Example
```
// Include a complete, copy-paste-ready example.
// For Dataview queries, Templater scripts, etc.
```

### Explanation
*A short explanation of how the solution works.*

## References

- [Obsidian Official Documentation](https://help.obsidian.md/Home)
- [deep-recon by kvarnelis](https://github.com/kvarnelis/deep-recon)
- [obsidian-skills by kepano](https://github.com/kepano/obsidian-skills/tree/main/skills)
