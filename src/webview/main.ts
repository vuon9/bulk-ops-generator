import { XMLParser } from 'fast-xml-parser';
import * as Handlebars from 'handlebars';
import { registerCustomHelpers } from './helpers';
type InputType = 'csv' | 'json' | 'tsv' | 'list' | 'xml';

interface AppState {
  mode: 'single' | 'bulk';
  inputType: InputType;
  inputData: string;
  listSeparator: string;
  singleTemplate: string;
  bulkPrefix: string;
  bulkTemplate: string;
  bulkSuffix: string;
  output: string;
  bulkJoinInline: boolean;
  savedSingleTemplates: { name: string; template: string }[];
  savedBulkTemplates: { name: string; prefix: string; template: string; suffix: string }[];
  selectedSingleTemplate: string;
  selectedBulkTemplate: string;
}

declare const acquireVsCodeApi: () => any;
const vscode = acquireVsCodeApi();

class App {
  private state: AppState = {
    mode: 'single',
    inputType: 'csv',
    inputData: '',
    listSeparator: ',',
    singleTemplate: '',
    bulkPrefix: '',
    bulkTemplate: '',
    bulkSuffix: '',
    output: '',
    bulkJoinInline: true,
    savedSingleTemplates: [],
    savedBulkTemplates: [],
    selectedSingleTemplate: '',
    selectedBulkTemplate: '',
  };

  constructor() {
    registerCustomHelpers();
    const previousState = vscode.getState();
    if (previousState) {
      // Migrate legacy state if it exists
      if (previousState.template && !previousState.singleTemplate) {
        previousState.singleTemplate = previousState.template;
        previousState.bulkTemplate = previousState.template;
      }
      if (previousState.prefix && !previousState.bulkPrefix) {
        previousState.bulkPrefix = previousState.prefix;
      }
      if (previousState.suffix && !previousState.bulkSuffix) {
        previousState.bulkSuffix = previousState.suffix;
      }

      // Clear legacy keys to prevent confusion
      delete (previousState as any).template;
      delete (previousState as any).prefix;
      delete (previousState as any).suffix;

      this.state = { ...this.state, ...previousState };
    }
    this.updateOutput();
    this.render();
  }

  private setState(newState: Partial<AppState>) {
    const prevMode = this.state.mode;
    const prevType = this.state.inputType;
    const prevBulkJoin = this.state.bulkJoinInline;

    this.state = { ...this.state, ...newState };
    this.updateOutput();
    vscode.setState(this.state);

    if (this.state.mode !== prevMode ||
      this.state.inputType !== prevType ||
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
    } else if (type === 'xml') {
      inputData = '<users>\n  <user>\n    <id>1</id>\n    <name>Alice</name>\n  </user>\n  <user>\n    <id>2</id>\n    <name>Bob</name>\n  </user>\n</users>';
      template = 'User {{name}} has ID {{id}}.';
    }

    const updates: Partial<AppState> = { inputData };
    if (mode === 'single') {
      updates.singleTemplate = template;
    } else {
      updates.bulkPrefix = prefix;
      updates.bulkTemplate = template;
      updates.bulkSuffix = suffix;
    }

    this.setState(updates);

    // After setState triggers render(), the new textareas should already have the correct values
    // but we can update them manually to be 100% sure if render() was skipped (though it shouldn't be)
    const elData = document.getElementById('input-data') as HTMLTextAreaElement;
    if (elData) elData.value = inputData;

    const elSingle = document.getElementById('input-single-template') as HTMLTextAreaElement;
    if (elSingle && mode === 'single') elSingle.value = template;

    const elBulk = document.getElementById('input-bulk-template') as HTMLTextAreaElement;
    if (elBulk && mode === 'bulk') elBulk.value = template;

    const elPrefix = document.getElementById('input-prefix') as HTMLTextAreaElement;
    if (elPrefix) elPrefix.value = prefix;

    const elSuffix = document.getElementById('input-suffix') as HTMLTextAreaElement;
    if (elSuffix) elSuffix.value = suffix;
  }

  private updateOutput() {
    if (!this.state.inputData) {
      this.state.output = '';
      return;
    }

    try {
      const data = this.parseInput(this.state.inputData);
      if (this.state.mode === 'single') {
        this.state.output = data.map((row) => this.applyTemplate(this.state.singleTemplate, row)).join('\n');
      } else {
        const separator = this.state.bulkJoinInline ? ', ' : ',\n';
        const generated = data.map((row) => this.applyTemplate(this.state.bulkTemplate, row)).join(separator);

        if (this.state.bulkJoinInline) {
          this.state.output = `${this.state.bulkPrefix}${generated}${this.state.bulkSuffix}`;
        } else {
          this.state.output = `${this.state.bulkPrefix}\n${generated}\n${this.state.bulkSuffix}`;
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
  }

  private saveTemplate() {
    const mode = this.state.mode;
    const templateName = window.prompt('Enter a name for this template:');

    if (!templateName) {
      return;
    }

    if (mode === 'single') {
      const existing = this.state.savedSingleTemplates.find(t => t.name === templateName);
      if (existing && !window.confirm(`Template "${templateName}" already exists. Overwrite it?`)) {
        return;
      }
      const newTemplate = { name: templateName, template: this.state.singleTemplate };
      const otherTemplates = this.state.savedSingleTemplates.filter(t => t.name !== templateName);
      this.setState({
        savedSingleTemplates: [...otherTemplates, newTemplate].sort((a, b) => a.name.localeCompare(b.name)),
        selectedSingleTemplate: templateName
      });
    } else { // bulk mode
      const existing = this.state.savedBulkTemplates.find(t => t.name === templateName);
      if (existing && !window.confirm(`Template "${templateName}" already exists. Overwrite it?`)) {
        return;
      }
      const newTemplate = {
        name: templateName,
        prefix: this.state.bulkPrefix,
        template: this.state.bulkTemplate,
        suffix: this.state.bulkSuffix,
      };
      const otherTemplates = this.state.savedBulkTemplates.filter(t => t.name !== templateName);
      this.setState({
        savedBulkTemplates: [...otherTemplates, newTemplate].sort((a, b) => a.name.localeCompare(b.name)),
        selectedBulkTemplate: templateName
      });
    }
  }

  private loadTemplate(name: string) {
    const mode = this.state.mode;

    if (mode === 'single') {
      const template = this.state.savedSingleTemplates.find(t => t.name === name);
      if (template) {
        this.setState({
          singleTemplate: template.template,
          selectedSingleTemplate: name,
        });
      } else {
        this.setState({ selectedSingleTemplate: '' });
      }
    } else { // bulk mode
      const template = this.state.savedBulkTemplates.find(t => t.name === name);
      if (template) {
        this.setState({
          bulkPrefix: template.prefix,
          bulkTemplate: template.template,
          bulkSuffix: template.suffix,
          selectedBulkTemplate: name,
        });
      } else {
        this.setState({ selectedBulkTemplate: '' });
      }
    }
  }

  private deleteTemplate() {
    const mode = this.state.mode;

    if (mode === 'single') {
      const templateName = this.state.selectedSingleTemplate;
      if (!templateName || !window.confirm(`Are you sure you want to delete "${templateName}"?`)) {
        return;
      }
      this.setState({
        savedSingleTemplates: this.state.savedSingleTemplates.filter(t => t.name !== templateName),
        selectedSingleTemplate: '',
        singleTemplate: ''
      });
    } else { // bulk mode
      const templateName = this.state.selectedBulkTemplate;
      if (!templateName || !window.confirm(`Are you sure you want to delete "${templateName}"?`)) {
        return;
      }
      this.setState({
        savedBulkTemplates: this.state.savedBulkTemplates.filter(t => t.name !== templateName),
        selectedBulkTemplate: '',
        bulkPrefix: '',
        bulkTemplate: '',
        bulkSuffix: ''
      });
    }
  }

  private parseInput(input: string): any[] {
    const type = this.state.inputType;

    if (type === 'json') {
      try {
        const parsed = JSON.parse(input);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (_e) {
        throw new Error('Invalid JSON');
      }
    }

    if (type === 'xml') {
      try {
        const parser = new XMLParser();
        const parsed = parser.parse(input);
        // Find the first array in the parsed object
        const rootKey = Object.keys(parsed)[0];
        const data = parsed[rootKey];
        const key = Object.keys(data).find(k => Array.isArray(data[k]));
        if (!key) {
          const firstKey = Object.keys(parsed)[0];
          return Array.isArray(parsed[firstKey]) ? parsed[firstKey] : [parsed[firstKey]];
        }
        return data[key];
      } catch (_e) {
        throw new Error('Invalid XML');
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
    try {
      const compiledTemplate = Handlebars.compile(template, { noEscape: true });
      return compiledTemplate(row);
    } catch (e) {
      return `Handlebars Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  private render() {
    const app = document.getElementById('app');
    if (!app) {
      return;
    }

    app.innerHTML = `
      <div id="autocomplete-dropdown" class="autocomplete-dropdown" style="display: none;"></div>
      <div class="container ${this.state.mode}">
        <div class="header-row">
          <div class="toolbar">
            <button class="tab-btn ${this.state.mode === 'single' ? 'active' : ''}" id="btn-single">Single Mode</button>
            <button class="tab-btn ${this.state.mode === 'bulk' ? 'active' : ''}" id="btn-bulk">Bulk Mode</button>
          </div>
        </div>

        <div class="input-options">
          <div class="option-group">
            <label>Input Type:</label>
            <div class="radio-group">
              <label class="radio-item"><input type="radio" name="inputType" value="csv" ${this.state.inputType === 'csv' ? 'checked' : ''}> CSV</label>
              <label class="radio-item"><input type="radio" name="inputType" value="json" ${this.state.inputType === 'json' ? 'checked' : ''}> JSON</label>
              <label class="radio-item"><input type="radio" name="inputType" value="tsv" ${this.state.inputType === 'tsv' ? 'checked' : ''}> TSV</label>
              <label class="radio-item"><input type="radio" name="inputType" value="xml" ${this.state.inputType === 'xml' ? 'checked' : ''}> XML</label>
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
              <div class="panel-header">
                <label>Input Data</label>
                <button id="btn-sample" class="secondary-btn">
                  <span class="icon">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a1 1 0 0 1 1 1v5.268l4.562-2.634a1 1 0 1 1 1 1.732L10 8l4.562 2.634a1 1 0 1 1-1 1.732L9 9.732V15a1 1 0 1 1-2 0V9.732l-4.562 2.634a1 1 0 1 1-1-1.732L6 8 1.438 5.366a1 1 0 0 1 1-1.732L7 6.268V1a1 1 0 0 1 1-1z"/></svg>
                  </span>
                  Load Sample
                </button>
              </div>
              <textarea id="input-data" placeholder="Paste your data here...">${this.state.inputData}</textarea>
            </div>
            ${this.state.mode === 'bulk' ? `
              <div class="panel">
                <label>Prefix</label>
                <textarea id="input-prefix" placeholder="INSERT INTO users (id, name) VALUES ">${this.state.bulkPrefix}</textarea>
              </div>
              <div class="panel">
                <div class="panel-header">
                  <label>Template</label>
                  <button id="btn-save-template" class="secondary-btn">
                    <span class="icon">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M14 1H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2zM4 0a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V3a3 3 0 0 0-3-3H4zm2 9h4v1H6V9zm0-2h6v1H6V7zm0-2h6v1H6V5z"/></svg>
                    </span>
                    Save Template
                  </button>
                  <div class="radio-group mini">
                    <label class="radio-item"><input type="radio" name="joinType" value="newline" ${!this.state.bulkJoinInline ? 'checked' : ''}> New Line</label>
                    <label class="radio-item"><input type="radio" name="joinType" value="inline" ${this.state.bulkJoinInline ? 'checked' : ''}> Inline</label>
                  </div>
                </div>
                <div class="template-loader">
                    <select id="load-template">
                        <option value="">Load a template...</option>
                        ${this.state.savedBulkTemplates.map(t => `<option value="${t.name}" ${this.state.selectedBulkTemplate === t.name ? 'selected' : ''}>${t.name}</option>`).join('')}
                    </select>
                    <button id="btn-delete-template" class="delete-btn ${!this.state.selectedBulkTemplate ? 'hidden' : ''}">
                        <span class="icon">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 1a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM4 3a1 1 0 0 0-1 1v1h10V4a1 1 0 0 0-1-1H4zm1 3v6a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V6H5zm2 1h1v4H7V7zm2 0h1v4H9V7z"/></svg>
                        </span>
                    </button>
                </div>
                <textarea id="input-bulk-template" placeholder="({{id}}, '{{name}}')">${this.state.bulkTemplate}</textarea>
              </div>
              <div class="panel">
                <label>Suffix</label>
                <textarea id="input-suffix" placeholder=";">${this.state.bulkSuffix}</textarea>
              </div>
            ` : `
              <div class="panel">
                <div class="panel-header">
                  <label>Template</label>
                  <button id="btn-save-template" class="secondary-btn">
                    <span class="icon">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M14 1H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2zM4 0a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V3a3 3 0 0 0-3-3H4zm2 9h4v1H6V9zm0-2h6v1H6V7zm0-2h6v1H6V5z"/></svg>
                    </span>
                    Save Template
                  </button>
                </div>
                <div class="template-loader">
                    <select id="load-template">
                        <option value="">Load a template...</option>
                        ${this.state.savedSingleTemplates.map(t => `<option value="${t.name}" ${this.state.selectedSingleTemplate === t.name ? 'selected' : ''}>${t.name}</option>`).join('')}
                    </select>
                    <button id="btn-delete-template" class="delete-btn ${!this.state.selectedSingleTemplate ? 'hidden' : ''}">
                        <span class="icon">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 1a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM4 3a1 1 0 0 0-1 1v1h10V4a1 1 0 0 0-1-1H4zm1 3v6a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V6H5zm2 1h1v4H7V7zm2 0h1v4H9V7z"/></svg>
                        </span>
                    </button>
                </div>
                <textarea id="input-single-template" placeholder="curl -X POST ... -d '{\\"id\\": \\"{{id}}\\", \\"name\\": \\"{{name}}\\"}'">${this.state.singleTemplate}</textarea>
              </div>
            `}
          </div>
          <div class="output-section">
            <div class="panel full-height">
              <label>Output</label>
              <div class="output-container">
                <textarea id="output-data" readonly>${this.state.output}</textarea>
              </div>
              <div class="highlight-controls">
                <div class="button-group">
                  <button id="btn-copy" class="primary-btn">
                    <span class="icon">
                       <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4h2v1H4v5h2v1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm0-3h5a1 1 0 0 1 1 1v1h-1V2H4v1H3V2a1 1 0 0 1 1-1zm8 2v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5.5l.5.5.5.5H11v.5zM7 7h3v1H7V7zm3 2H7v1h3V9zm-3 2h3v1H7v-1z"/></svg>
                    </span>
                    Copy to Clipboard
                  </button>
                  <button id="btn-export" class="primary-btn">
                    <span class="icon">
                       <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9 1.5l3.5 3.5H9V1.5zM4 1h4v4h4v10H4V1z"/></svg>
                    </span>
                    Export to File
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private handleTemplateInput(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    const text = textarea.value;

    if (textarea.id === 'input-single-template') {
        this.state.singleTemplate = text;
    } else if (textarea.id === 'input-bulk-template') {
        this.state.bulkTemplate = text;
    }
    this.updateOutput();
    vscode.setState(this.state);
    this.updateIncrementalUI();
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);
    const triggerPattern = /{{([^}]*)$/;
    const match = textBeforeCursor.match(triggerPattern);

    const dropdown = document.getElementById('autocomplete-dropdown') as HTMLElement;

    if (match) {
        const parsedData = this.parseInput(this.state.inputData);
        if (!parsedData.length) {
            dropdown.style.display = 'none';
            return;
        }
        const keys = Array.from(new Set(parsedData.flatMap(row => Object.keys(row))));
        const search = match[1].trim().toLowerCase();
        const filteredKeys = keys.filter(key => key.toLowerCase().includes(search));

        if (filteredKeys.length > 0) {
            const rect = textarea.getBoundingClientRect();
            const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight, 10) || 20;
            const lines = textBeforeCursor.split('\n');
            const currentLine = lines.length - 1;
            const currentLineText = lines[currentLine];
            const charPos = currentLineText.lastIndexOf('{{') + 2;

            const textMeasure = document.createElement('span');
            textMeasure.style.font = window.getComputedStyle(textarea).font;
            textMeasure.style.whiteSpace = 'pre';
            textMeasure.textContent = currentLineText.substring(0, charPos);
            document.body.appendChild(textMeasure);
            const textWidth = textMeasure.getBoundingClientRect().width;
            document.body.removeChild(textMeasure);


            dropdown.innerHTML = filteredKeys.map(key => `<div class="autocomplete-item">${key}</div>`).join('');
            dropdown.style.display = 'block';
            dropdown.style.left = `${rect.left + textWidth}px`;
            dropdown.style.top = `${rect.top + (currentLine + 1) * lineHeight}px`;

            document.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('click', () => {
                    const key = item.textContent || '';
                    const newText = textBeforeCursor.replace(triggerPattern, `{{${key}}}`) + text.substring(cursorPos);
                    textarea.value = newText;
                    textarea.focus();
                    dropdown.style.display = 'none';
                    if (textarea.id === 'input-single-template') {
                        this.state.singleTemplate = newText;
                    } else if (textarea.id === 'input-bulk-template') {
                        this.state.bulkTemplate = newText;
                    }
                    this.updateOutput();
                });
            });
        } else {
            dropdown.style.display = 'none';
        }
    } else {
        dropdown.style.display = 'none';
    }
}
  private attachEventListeners() {
    document.getElementById('btn-single')?.addEventListener('click', () => this.setState({ mode: 'single' }));
    document.getElementById('btn-bulk')?.addEventListener('click', () => this.setState({ mode: 'bulk' }));
    document.getElementById('btn-sample')?.addEventListener('click', () => this.loadSample());
    document.getElementById('btn-save-template')?.addEventListener('click', () => this.saveTemplate());
    document.getElementById('btn-delete-template')?.addEventListener('click', () => this.deleteTemplate());

    document.getElementById('load-template')?.addEventListener('change', (e) => {
      const selectedTemplate = (e.target as HTMLSelectElement).value;
      this.loadTemplate(selectedTemplate);
    });

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

    const setupInputListener = (id: string, key: keyof AppState) => {
      const el = document.getElementById(id) as HTMLTextAreaElement;
      if (!el) {
        return;
      }
      el.addEventListener('input', (e) => {
        const val = (e.target as HTMLTextAreaElement).value;
        this.state = { ...this.state, [key]: val };
        this.updateOutput();
        vscode.setState(this.state);
        this.updateIncrementalUI();
      });
    };

    setupInputListener('input-data', 'inputData');

    document.getElementById('input-prefix')?.addEventListener('input', (e) => {
      this.state.bulkPrefix = (e.target as HTMLTextAreaElement).value;
      this.updateOutput();
      vscode.setState(this.state);
      this.updateIncrementalUI();
    });

    document.getElementById('input-single-template')?.addEventListener('input', (e) => {
      this.state.singleTemplate = (e.target as HTMLTextAreaElement).value;
      this.state.selectedSingleTemplate = '';
      this.updateOutput();
      vscode.setState(this.state);
      this.updateIncrementalUI();
      this.render(); // Re-render to clear selection
    });

    document.getElementById('input-bulk-template')?.addEventListener('input', (e) => {
      this.state.bulkTemplate = (e.target as HTMLTextAreaElement).value;
      this.state.selectedBulkTemplate = '';
      this.updateOutput();
      vscode.setState(this.state);
      this.updateIncrementalUI();
      this.render(); // Re-render to clear selection
    });

    document.getElementById('input-suffix')?.addEventListener('input', (e) => {
      this.state.bulkSuffix = (e.target as HTMLTextAreaElement).value;
      this.updateOutput();
      vscode.setState(this.state);
      this.updateIncrementalUI();
    });

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

    document.getElementById('btn-export')?.addEventListener('click', () => {
      vscode.postMessage({
        command: 'export',
        text: this.state.output
      });
    });
  }
}

new App();
