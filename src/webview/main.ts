type InputType = 'csv' | 'json' | 'tsv' | 'list';

interface AppState {
  mode: 'single' | 'bulk';
  inputType: InputType;
  inputData: string;
  listSeparator: string;
  prefix: string;
  template: string;
  suffix: string;
  output: string;
  enableHighlighting: boolean;
  bulkJoinInline: boolean;
}

class App {
  private state: AppState = {
    mode: 'single',
    inputType: 'csv',
    inputData: '',
    listSeparator: ',',
    prefix: '',
    template: '',
    suffix: '',
    output: '',
    enableHighlighting: true,
    bulkJoinInline: false,
  };

  constructor() {
    this.render();
  }

  private setState(newState: Partial<AppState>) {
    const prevMode = this.state.mode;
    const prevType = this.state.inputType;
    const prevHighlight = this.state.enableHighlighting;
    const prevBulkJoin = this.state.bulkJoinInline;

    this.state = { ...this.state, ...newState };
    this.updateOutput();

    if (this.state.mode !== prevMode ||
      this.state.inputType !== prevType ||
      this.state.enableHighlighting !== prevHighlight ||
      this.state.bulkJoinInline !== prevBulkJoin) {
      this.render();
    } else {
      this.updateIncrementalUI();
    }
  }

  private loadSample() {
    const type = this.state.inputType;
    const mode = this.state.mode;

    let inputData = '';
    let template = '';
    let prefix = '';
    let suffix = '';

    if (type === 'json') {
      inputData = '[\n  {"id": 1, "name": "Alice"},\n  {"id": 2, "name": "Bob"}\n]';
      if (mode === 'single') {
        template = 'curl -X POST /api/users -d \'{"id": {{id}}, "name": "{{name}}"}\'';
      } else {
        prefix = 'INSERT INTO users (id, name) VALUES ';
        template = '({{id}}, \'{{name}}\')';
        suffix = ';';
      }
    } else if (type === 'csv') {
      inputData = 'id,name,role\n1,Alice,Admin\n2,Bob,User';
      if (mode === 'single') {
        template = 'Sending invite to {{name}} ({{role}})...';
      } else {
        prefix = 'UPDATE roles SET status = \'active\' WHERE id IN (';
        template = '{{id}}';
        suffix = ');';
      }
    } else if (type === 'tsv') {
      inputData = 'id\tname\tscore\n1\tAlice\t95\n2\tBob\t88';
      template = 'User {{name}} scored {{score}} points.';
    } else if (type === 'list') {
      inputData = 'apple, banana, cherry';
      template = 'I want to eat {{value}}';
    }

    this.setState({ inputData, template, prefix, suffix });

    const ids = ['input-data', 'input-template', 'input-prefix', 'input-suffix'];
    ids.forEach(id => {
      const el = document.getElementById(id) as HTMLTextAreaElement;
      if (el) {
        if (id === 'input-data') { el.value = inputData; }
        if (id === 'input-template') { el.value = template; }
        if (id === 'input-prefix') { el.value = prefix; }
        if (id === 'input-suffix') { el.value = suffix; }
      }
    });
  }

  private updateOutput() {
    if (!this.state.inputData) {
      this.state.output = '';
      return;
    }

    try {
      const data = this.parseInput(this.state.inputData);
      if (this.state.mode === 'single') {
        this.state.output = data.map((row) => this.applyTemplate(this.state.template, row)).join('\n');
      } else {
        const separator = this.state.bulkJoinInline ? ', ' : ',\n';
        const generated = data.map((row) => this.applyTemplate(this.state.template, row)).join(separator);

        if (this.state.bulkJoinInline) {
          this.state.output = `${this.state.prefix}${generated}${this.state.suffix}`;
        } else {
          this.state.output = `${this.state.prefix}\n${generated}\n${this.state.suffix}`;
        }
      }
    } catch (e) {
      this.state.output = `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  private updateIncrementalUI() {
    const outputArea = document.getElementById('output-data') as HTMLTextAreaElement;
    if (outputArea) {
      outputArea.value = this.state.output;
    }

    if (this.state.enableHighlighting) {
      const overlay = document.getElementById('highlight-overlay');
      if (overlay) {
        overlay.innerHTML = this.highlight(this.state.output);
      }
    }
  }

  private parseInput(input: string): any[] {
    const type = this.state.inputType;

    if (type === 'json') {
      try {
        const parsed = JSON.parse(input);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        throw new Error('Invalid JSON');
      }
    }

    let separator = ',';
    if (type === 'tsv') {
      separator = '\t';
    }
    if (type === 'list') {
      separator = this.state.listSeparator || ',';
      return input.split(separator).map(item => ({ value: item.trim() })).filter(item => item.value);
    }

    const lines = input.trim().split('\n');
    if (lines.length < 1) {
      return [];
    }

    const headers = lines[0].split(separator).map((h) => h.trim());
    if (lines.length === 1) {
      return [];
    }

    return lines.slice(1).map((line) => {
      const values = line.split(separator).map((v) => v.trim());
      const obj: any = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] || '';
      });
      return obj;
    });
  }

  private applyTemplate(template: string, row: any): string {
    return template.replace(/{{(\w+)}}/g, (_, key) => {
      return row[key] !== undefined ? row[key] : `{{${key}}}`;
    });
  }

  private highlight(text: string): string {
    if (!text) {
      return '';
    }

    // 1. Escape HTML
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 2. Highlighting using placeholders to prevent double-processing
    const tokens: string[] = [];
    const addToken = (str: string, className: string) => {
      const id = `__TOKEN_${tokens.length}__`;
      tokens.push(`<span class="${className}">${str}</span>`);
      return id;
    };

    // Strings (handle these first to avoid matching keywords inside them)
    html = html.replace(/'([^']*)'/g, (_, p1) => addToken(`'${p1}'`, 'hl-string'));
    html = html.replace(/"([^"]*)"/g, (_, p1) => addToken(`"${p1}"`, 'hl-string'));

    // Keywords
    const keywords = /\b(INSERT|INTO|VALUES|SELECT|FROM|WHERE|UPDATE|DELETE|SET|TABLE|CREATE|DROP|ALTER|AND|OR|NOT|NULL|TRUE|FALSE|curl|POST|GET|PUT|PATCH|DELETE|headers|authorization|bearer)\b/gi;
    html = html.replace(keywords, (match) => addToken(match, 'hl-keyword'));

    // Numbers
    html = html.replace(/\b(\d+)\b/g, (match) => addToken(match, 'hl-number'));

    // 3. Restore tokens
    tokens.forEach((token, i) => {
      html = html.replace(`__TOKEN_${i}__`, token);
    });

    return html;
  }

  private render() {
    const app = document.getElementById('app');
    if (!app) {
      return;
    }

    app.innerHTML = `
      <div class="container ${this.state.mode} ${this.state.enableHighlighting ? 'show-highlight' : ''}">
        <div class="header-row">
          <div class="toolbar">
            <button class="tab-btn ${this.state.mode === 'single' ? 'active' : ''}" id="btn-single">Single Mode</button>
            <button class="tab-btn ${this.state.mode === 'bulk' ? 'active' : ''}" id="btn-bulk">Bulk Mode</button>
          </div>
          <button id="btn-sample" class="secondary-btn">
            <span class="icon">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a1 1 0 0 1 1 1v5.268l4.562-2.634a1 1 0 1 1 1 1.732L10 8l4.562 2.634a1 1 0 1 1-1 1.732L9 9.732V15a1 1 0 1 1-2 0V9.732l-4.562 2.634a1 1 0 1 1-1-1.732L6 8 1.438 5.366a1 1 0 0 1 1-1.732L7 6.268V1a1 1 0 0 1 1-1z"/></svg>
            </span>
            Load Sample
          </button>
        </div>

        <div class="input-options">
          <div class="option-group">
            <label>Input Type:</label>
            <div class="radio-group">
              <label class="radio-item"><input type="radio" name="inputType" value="csv" ${this.state.inputType === 'csv' ? 'checked' : ''}> CSV</label>
              <label class="radio-item"><input type="radio" name="inputType" value="json" ${this.state.inputType === 'json' ? 'checked' : ''}> JSON</label>
              <label class="radio-item"><input type="radio" name="inputType" value="tsv" ${this.state.inputType === 'tsv' ? 'checked' : ''}> TSV</label>
              <label class="radio-item"><input type="radio" name="inputType" value="list" ${this.state.inputType === 'list' ? 'checked' : ''}> List</label>
            </div>
          </div>

          ${this.state.inputType === 'list' ? `
            <div class="option-group separator-config">
              <label>Separator:</label>
              <input type="text" id="list-separator" class="small-input" value="${this.state.listSeparator}">
            </div>
          ` : ''}

        </div>

        <div class="layout">
          <div class="input-section">
            <div class="panel">
              <label>Input Data</label>
              <textarea id="input-data" placeholder="Paste your data here...">${this.state.inputData}</textarea>
            </div>
            ${this.state.mode === 'bulk' ? `
              <div class="panel">
                <label>Prefix</label>
                <textarea id="input-prefix" placeholder="INSERT INTO users (id, name) VALUES ">${this.state.prefix}</textarea>
              </div>
              <div class="panel">
                <div class="panel-header">
                  <label>Template</label>
                  <div class="radio-group mini">
                    <label class="radio-item"><input type="radio" name="joinType" value="newline" ${!this.state.bulkJoinInline ? 'checked' : ''}> New Line</label>
                    <label class="radio-item"><input type="radio" name="joinType" value="inline" ${this.state.bulkJoinInline ? 'checked' : ''}> Inline</label>
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
                  <input type="checkbox" id="check-highlight" ${this.state.enableHighlighting ? 'checked' : ''}>
                  Syntax Highlighting
                </label>
                <button id="btn-copy">
                  <span class="icon">
                     <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4h2v1H4v5h2v1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm0-3h5a1 1 0 0 1 1 1v1h-1V2H4v1H3V2a1 1 0 0 1 1-1zm8 2v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5.5l.5.5.5.5H11v.5zM7 7h3v1H7V7zm3 2H7v1h3V9zm-3 2h3v1H7v-1z"/></svg>
                  </span>
                  Copy to Clipboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners() {
    document.getElementById('btn-single')?.addEventListener('click', () => this.setState({ mode: 'single' }));
    document.getElementById('btn-bulk')?.addEventListener('click', () => this.setState({ mode: 'bulk' }));
    document.getElementById('btn-sample')?.addEventListener('click', () => this.loadSample());

    document.getElementsByName('inputType').forEach(el => {
      el.addEventListener('change', (e) => {
        this.setState({ inputType: (e.target as HTMLInputElement).value as InputType });
      });
    });

    document.getElementsByName('joinType').forEach(el => {
      el.addEventListener('change', (e) => {
        this.setState({ bulkJoinInline: (e.target as HTMLInputElement).value === 'inline' });
      });
    });

    document.getElementById('list-separator')?.addEventListener('input', (e) => {
      this.setState({ listSeparator: (e.target as HTMLInputElement).value });
    });

    document.getElementById('check-highlight')?.addEventListener('change', (e) => {
      this.setState({ enableHighlighting: (e.target as HTMLInputElement).checked });
    });

    const setupInputListener = (id: string, key: keyof AppState) => {
      const el = document.getElementById(id) as HTMLTextAreaElement;
      if (!el) {
        return;
      }
      el.addEventListener('input', (e) => {
        const val = (e.target as HTMLTextAreaElement).value;
        this.state = { ...this.state, [key]: val };
        this.updateOutput();
        this.updateIncrementalUI();
      });
    };

    setupInputListener('input-data', 'inputData');
    setupInputListener('input-prefix', 'prefix');
    setupInputListener('input-template', 'template');
    setupInputListener('input-suffix', 'suffix');

    document.getElementById('btn-copy')?.addEventListener('click', () => {
      const outputArea = document.getElementById('output-data') as HTMLTextAreaElement;
      outputArea.select();
      document.execCommand('copy');

      const btn = document.getElementById('btn-copy');
      if (btn) {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<span>✓</span> Copied!';
        setTimeout(() => { if (btn) { btn.innerHTML = originalHTML; } }, 2000);
      }
    });
  }
}

new App();
