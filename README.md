# Bulk Ops Generator for VS Code

Transform your data into actionable operations instantly. **Bulk Ops Generator** takes CSV, JSON, TSV, or List data and converts it into bulk commands (like SQL, cURL, etc.) using customizable templates.

![Bulk Ops Generator Preview](https://raw.githubusercontent.com/vuon9/bulk-ops-generator/main/images/preview.png)
*(Note: Add a preview image to your repository)*

## Features

### 🚀 Dual Modes
- **Single Mode**: Process data row-by-row. Perfect for generating a list of individual API calls (cURL) or independent commands.
- **Bulk Mode**: Aggregate all your data into a single block. Ideal for SQL `INSERT` statements with multiple `VALUES`, or comma-separated lists.

### 📄 Flexible Inputs
- **CSV**: Standard comma-separated values.
- **JSON**: Paste a JSON array or object.
- **TSV**: Tab-separated values (great for Excel/Sheet copies).
- **List**: Simple text lists with configurable custom separators (comma, pipe, new line, etc.).

### 🎨 Premium Editing Experience
- **Real-time Preview**: See your output instantly as you type.
- **Syntax Highlighting**: Built-in highlighting for SQL keywords, JSON keys, Strings, and more.
- **Smart Configurations**:
    - **Join Type**: Choose between "New Line" or "Inline" for your bulk operations.
    - **Template Tags**: Use `{{column_name}}` to map your data fields dynamically.
- **Sample Data**: One-click sample loader to help you get started with any input type.

## How to Use

1.  Open the Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`).
2.  Run `Bulk Ops Generator: Open`.
3.  **Input**: Select your input type (CSV, JSON, etc.) and paste your data.
4.  **Configure**:
    - Switch to **Single** or **Bulk** mode.
    - Write your **Template** using `{{key}}` syntax.
    - In Bulk mode, set a **Prefix** (start of block) and **Suffix** (end of block).
5.  **Output**: Copy the generated code to your clipboard!

## Example

**Input (CSV):**
```csv
id,name
1,Alice
2,Bob
```

**Template:**
`({{id}}, '{{name}}')`

**Output (Bulk SQL):**
```sql
INSERT INTO users (id, name) VALUES
(1, 'Alice'),
(2, 'Bob');
```

## Release Notes

### 0.0.1
- Initial release with Single and Bulk modes.
- Support for CSV, JSON, TSV, and List inputs.
- Syntax highlighting and sample data loader.

---

**Enjoying the extension?** Please leave a review!
