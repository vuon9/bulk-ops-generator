"use strict";
(() => {
  // src/webview/main.ts
  var App = class {
    state = {
      mode: "single",
      inputType: "csv",
      inputData: "",
      listSeparator: ",",
      prefix: "",
      template: "",
      suffix: "",
      output: "",
      enableHighlighting: false,
      bulkJoinInline: false
    };
    constructor() {
      this.render();
    }
    setState(newState) {
      const prevMode = this.state.mode;
      const prevType = this.state.inputType;
      const prevHighlight = this.state.enableHighlighting;
      const prevBulkJoin = this.state.bulkJoinInline;
      this.state = { ...this.state, ...newState };
      this.updateOutput();
      if (this.state.mode !== prevMode || this.state.inputType !== prevType || this.state.enableHighlighting !== prevHighlight || this.state.bulkJoinInline !== prevBulkJoin) {
        this.render();
      } else {
        this.updateIncrementalUI();
      }
    }
    loadSample() {
      const type = this.state.inputType;
      const mode = this.state.mode;
      let inputData = "";
      let template = "";
      let prefix = "";
      let suffix = "";
      if (type === "json") {
        inputData = '[\n  {"id": 1, "name": "Alice"},\n  {"id": 2, "name": "Bob"}\n]';
        if (mode === "single") {
          template = `curl -X POST /api/users -d '{"id": {{id}}, "name": "{{name}}"}'`;
        } else {
          prefix = "INSERT INTO users (id, name) VALUES ";
          template = "({{id}}, '{{name}}')";
          suffix = ";";
        }
      } else if (type === "csv") {
        inputData = "id,name,role\n1,Alice,Admin\n2,Bob,User";
        if (mode === "single") {
          template = "Sending invite to {{name}} ({{role}})...";
        } else {
          prefix = "UPDATE roles SET status = 'active' WHERE id IN (";
          template = "{{id}}";
          suffix = ");";
        }
      } else if (type === "tsv") {
        inputData = "id	name	score\n1	Alice	95\n2	Bob	88";
        template = "User {{name}} scored {{score}} points.";
      } else if (type === "list") {
        inputData = "apple, banana, cherry";
        template = "I want to eat {{value}}";
      }
      this.setState({ inputData, template, prefix, suffix });
      const ids = ["input-data", "input-template", "input-prefix", "input-suffix"];
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          if (id === "input-data") {
            el.value = inputData;
          }
          if (id === "input-template") {
            el.value = template;
          }
          if (id === "input-prefix") {
            el.value = prefix;
          }
          if (id === "input-suffix") {
            el.value = suffix;
          }
        }
      });
    }
    updateOutput() {
      if (!this.state.inputData) {
        this.state.output = "";
        return;
      }
      try {
        const data = this.parseInput(this.state.inputData);
        if (this.state.mode === "single") {
          this.state.output = data.map((row) => this.applyTemplate(this.state.template, row)).join("\n");
        } else {
          const separator = this.state.bulkJoinInline ? ", " : ",\n";
          const generated = data.map((row) => this.applyTemplate(this.state.template, row)).join(separator);
          if (this.state.bulkJoinInline) {
            this.state.output = `${this.state.prefix}${generated}${this.state.suffix}`;
          } else {
            this.state.output = `${this.state.prefix}
${generated}
${this.state.suffix}`;
          }
        }
      } catch (e) {
        this.state.output = `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    updateIncrementalUI() {
      const outputArea = document.getElementById("output-data");
      if (outputArea) {
        outputArea.value = this.state.output;
      }
      if (this.state.enableHighlighting) {
        const overlay = document.getElementById("highlight-overlay");
        if (overlay) {
          overlay.innerHTML = this.highlight(this.state.output);
        }
      }
    }
    parseInput(input) {
      const type = this.state.inputType;
      if (type === "json") {
        try {
          const parsed = JSON.parse(input);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
          throw new Error("Invalid JSON");
        }
      }
      let separator = ",";
      if (type === "tsv") {
        separator = "	";
      }
      if (type === "list") {
        separator = this.state.listSeparator || ",";
        return input.split(separator).map((item) => ({ value: item.trim() })).filter((item) => item.value);
      }
      const lines = input.trim().split("\n");
      if (lines.length < 1) {
        return [];
      }
      const headers = lines[0].split(separator).map((h) => h.trim());
      if (lines.length === 1) {
        return [];
      }
      return lines.slice(1).map((line) => {
        const values = line.split(separator).map((v) => v.trim());
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = values[i] || "";
        });
        return obj;
      });
    }
    applyTemplate(template, row) {
      return template.replace(/{{(\w+)}}/g, (_, key) => {
        return row[key] !== void 0 ? row[key] : `{{${key}}}`;
      });
    }
    highlight(text) {
      if (!text) {
        return "";
      }
      let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const tokens = [];
      const addToken = (str, className) => {
        const id = `__TOKEN_${tokens.length}__`;
        tokens.push(`<span class="${className}">${str}</span>`);
        return id;
      };
      html = html.replace(/'([^']*)'/g, (_, p1) => addToken(`'${p1}'`, "hl-string"));
      html = html.replace(/"([^"]*)"/g, (_, p1) => addToken(`"${p1}"`, "hl-string"));
      const keywords = /\b(INSERT|INTO|VALUES|SELECT|FROM|WHERE|UPDATE|DELETE|SET|TABLE|CREATE|DROP|ALTER|AND|OR|NOT|NULL|TRUE|FALSE|curl|POST|GET|PUT|PATCH|DELETE|headers|authorization|bearer)\b/gi;
      html = html.replace(keywords, (match) => addToken(match, "hl-keyword"));
      html = html.replace(/\b(\d+)\b/g, (match) => addToken(match, "hl-number"));
      tokens.forEach((token, i) => {
        html = html.replace(`__TOKEN_${i}__`, token);
      });
      return html;
    }
    render() {
      const app = document.getElementById("app");
      if (!app) {
        return;
      }
      app.innerHTML = `
      <div class="container ${this.state.mode} ${this.state.enableHighlighting ? "show-highlight" : ""}">
        <div class="header-row">
          <div class="toolbar">
            <button class="tab-btn ${this.state.mode === "single" ? "active" : ""}" id="btn-single">Single Mode</button>
            <button class="tab-btn ${this.state.mode === "bulk" ? "active" : ""}" id="btn-bulk">Bulk Mode</button>
          </div>
          <button id="btn-sample" class="secondary-btn">\u2728 Load Sample</button>
        </div>

        <div class="input-options">
          <div class="option-group">
            <label>Input Type:</label>
            <div class="radio-group">
              <label class="radio-item"><input type="radio" name="inputType" value="csv" ${this.state.inputType === "csv" ? "checked" : ""}> CSV</label>
              <label class="radio-item"><input type="radio" name="inputType" value="json" ${this.state.inputType === "json" ? "checked" : ""}> JSON</label>
              <label class="radio-item"><input type="radio" name="inputType" value="tsv" ${this.state.inputType === "tsv" ? "checked" : ""}> TSV</label>
              <label class="radio-item"><input type="radio" name="inputType" value="list" ${this.state.inputType === "list" ? "checked" : ""}> List</label>
            </div>
          </div>

          ${this.state.inputType === "list" ? `
            <div class="option-group separator-config">
              <label>Separator:</label>
              <input type="text" id="list-separator" class="small-input" value="${this.state.listSeparator}">
            </div>
          ` : ""}

        </div>

        <div class="layout">
          <div class="input-section">
            <div class="panel">
              <label>Input Data</label>
              <textarea id="input-data" placeholder="Paste your data here...">${this.state.inputData}</textarea>
            </div>
            ${this.state.mode === "bulk" ? `
              <div class="panel">
                <label>Prefix</label>
                <textarea id="input-prefix" placeholder="INSERT INTO users (id, name) VALUES ">${this.state.prefix}</textarea>
              </div>
              <div class="panel">
                <div class="panel-header">
                  <label>Template</label>
                  <div class="radio-group mini">
                    <label class="radio-item"><input type="radio" name="joinType" value="newline" ${!this.state.bulkJoinInline ? "checked" : ""}> New Line</label>
                    <label class="radio-item"><input type="radio" name="joinType" value="inline" ${this.state.bulkJoinInline ? "checked" : ""}> Inline</label>
                  </div>
                </div>
                <textarea id="input-template" placeholder="({{id}}, '{{name}}')">${this.state.template}</textarea>
              </div>
              <div class="panel">
                <label>Suffix</label>
                <textarea id="input-suffix" placeholder=";">${this.state.suffix}</textarea>
              </div>
            ` : `
              <div class="panel">
                <label>Template</label>
                <textarea id="input-template" placeholder="curl -X POST ... -d '{\\"id\\": \\"{{id}}\\", \\"name\\": \\"{{name}}\\"}'">${this.state.template}</textarea>
              </div>
            `}
          </div>
          <div class="output-section">
            <div class="panel full-height">
              <label>Output</label>
              <div class="output-container">
                <textarea id="output-data" readonly>${this.state.output}</textarea>
                <div id="highlight-overlay" class="highlight-overlay">${this.highlight(this.state.output)}</div>
              </div>
              <div class="highlight-controls">
                <label class="highlight-toggle">
                  <input type="checkbox" id="check-highlight" ${this.state.enableHighlighting ? "checked" : ""}>
                  Syntax Highlighting
                </label>
                <button id="btn-copy">Copy to Clipboard</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
      this.attachEventListeners();
    }
    attachEventListeners() {
      document.getElementById("btn-single")?.addEventListener("click", () => this.setState({ mode: "single" }));
      document.getElementById("btn-bulk")?.addEventListener("click", () => this.setState({ mode: "bulk" }));
      document.getElementById("btn-sample")?.addEventListener("click", () => this.loadSample());
      document.getElementsByName("inputType").forEach((el) => {
        el.addEventListener("change", (e) => {
          this.setState({ inputType: e.target.value });
        });
      });
      document.getElementsByName("joinType").forEach((el) => {
        el.addEventListener("change", (e) => {
          this.setState({ bulkJoinInline: e.target.value === "inline" });
        });
      });
      document.getElementById("list-separator")?.addEventListener("input", (e) => {
        this.setState({ listSeparator: e.target.value });
      });
      document.getElementById("check-highlight")?.addEventListener("change", (e) => {
        this.setState({ enableHighlighting: e.target.checked });
      });
      const setupInputListener = (id, key) => {
        const el = document.getElementById(id);
        if (!el) {
          return;
        }
        el.addEventListener("input", (e) => {
          const val = e.target.value;
          this.state = { ...this.state, [key]: val };
          this.updateOutput();
          this.updateIncrementalUI();
        });
      };
      setupInputListener("input-data", "inputData");
      setupInputListener("input-prefix", "prefix");
      setupInputListener("input-template", "template");
      setupInputListener("input-suffix", "suffix");
      document.getElementById("btn-copy")?.addEventListener("click", () => {
        const outputArea = document.getElementById("output-data");
        outputArea.select();
        document.execCommand("copy");
        const btn = document.getElementById("btn-copy");
        if (btn) {
          const originalText = btn.innerText;
          btn.innerHTML = "\u2713 Copied!";
          setTimeout(() => {
            if (btn) {
              btn.innerText = originalText;
            }
          }, 2e3);
        }
      });
    }
  };
  new App();
})();
//# sourceMappingURL=webview.js.map
