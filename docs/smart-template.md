# Smart Template Guide

The Smart Template feature brings more power and flexibility to your data transformations. It's built on Handlebars.js, which means you can use variables, conditional logic, loops, and custom functions right in your templates.

## Auto-completion

When you type `{{` in the template editor, an auto-completion dropdown will appear, suggesting the keys from your input data (e.g., CSV headers or JSON keys). This helps you avoid typos and quickly insert the correct variables into your template.

## Conditional Logic (`if`/`else`)

You can use the `#if` helper to add conditional logic to your templates. This is useful for when you only want to include a piece of text if a certain condition is met.

**Example:**

Let's say you have the following CSV data:

```csv
name,role
Alice,Admin
Bob,User
```

You can use the following template to add a special note for admins:

```handlebars
{{name}} is a {{role}}{{#if (eq role "Admin")}} (Super User){{/if}}
```

**Output:**

```
Alice is a Admin (Super User)
Bob is a User
```

## Loops (`each`)

The `#each` helper allows you to loop over arrays in your data. This is useful when you have nested data and want to generate a line for each item in a list.

**Example:**

Given the following JSON data:

```json
[
  {
    "name": "Alice",
    "skills": ["SQL", "Python"]
  },
  {
    "name": "Bob",
    "skills": ["JavaScript"]
  }
]
```

You can use this template to list each user's skills:

```handlebars
{{name}}'s skills:
{{#each skills}}
- {{this}}
{{/each}}
```

**Output:**

```
Alice's skills:
- SQL
- Python

Bob's skills:
- JavaScript
```

## Custom Helpers

We've also added some custom helpers for common text transformations.

### `uppercase`

Converts a string to uppercase.

-   **Template:** `{{uppercase name}}`
-   **Output:** `ALICE`

### `lowercase`

Converts a string to lowercase.

-   **Template:** `{{lowercase name}}`
-   **Output:** `alice`

### `capitalize`

Capitalizes the first letter of a string.

-   **Template:** `{{capitalize name}}`
-   **Output:** `Alice`

### `default`

Provides a fallback value if a variable is missing or null.

-   **Template:** `{{default country "N/A"}}`
-   **Output:** `N/A` (if the `country` key is not in the data)
