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
  isSaving: boolean;
  templateNameInput: string;
  showConfirm: boolean;
  confirmMessage: string;
  confirmAction: (() => void) | null;
  isDirty: boolean;
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
    isSaving: false,
    templateNameInput: '',
    showConfirm: false,
    confirmMessage: '',
    confirmAction: null,
    isDirty: false,
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
    const prevIsSaving = this.state.isSaving;
    const prevShowConfirm = this.state.showConfirm;

    this.state = { ...this.state, ...newState };
    this.updateOutput();
    vscode.setState(this.state);

    if (
      this.state.mode !== prevMode ||
      this.state.inputType !== prevType ||
      this.state.bulkJoinInline !== prevBulkJoin ||
      this.state.isSaving !== prevIsSaving ||
      this.state.showConfirm !== prevShowConfirm
    ) {
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

  private saveTemplate(isSaveAs: boolean) {
    const mode = this.state.mode;
    const selectedTemplate = mode === 'single' ? this.state.selectedSingleTemplate : this.state.selectedBulkTemplate;

    if (!isSaveAs && selectedTemplate) {
      // Overwrite existing template
      this.confirmSave(selectedTemplate, false);
    } else {
      // Show input for new template name
      this.setState({ isSaving: true, templateNameInput: isSaveAs && selectedTemplate ? selectedTemplate + ' (copy)' : '' });
      this.render(); // Re-render to show the input field
      const input = document.getElementById('template-name-input') as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }
  }

  private confirmSave(name: string, isNew: boolean) {
    if (!name) return;

    const mode = this.state.mode;

    const saveAction = () => {
      if (mode === 'single') {
        const newTemplate = { name, template: this.state.singleTemplate };
        const otherTemplates = this.state.savedSingleTemplates.filter(t => t.name !== name);
        this.setState({
          savedSingleTemplates: [...otherTemplates, newTemplate].sort((a, b) => a.name.localeCompare(b.name)),
          selectedSingleTemplate: name,
          isSaving: false,
          templateNameInput: '',
          showConfirm: false,
          isDirty: false,
        });
      } else { // bulk mode
        const newTemplate = {
          name,
          prefix: this.state.bulkPrefix,
          template: this.state.bulkTemplate,
          suffix: this.state.bulkSuffix,
        };
        const otherTemplates = this.state.savedBulkTemplates.filter(t => t.name !== name);
        this.setState({
          savedBulkTemplates: [...otherTemplates, newTemplate].sort((a, b) => a.name.localeCompare(b.name)),
          selectedBulkTemplate: name,
          isSaving: false,
          templateNameInput: '',
          showConfirm: false,
          isDirty: false,
        });
      }
      this.render(); // Re-render to hide input and update dropdown
    };

    if (mode === 'single') {
      const existing = this.state.savedSingleTemplates.find(t => t.name === name);
      if (isNew && existing) {
        this.setState({
          showConfirm: true,
          confirmMessage: `Template "${name}" already exists. Overwrite it?`,
          confirmAction: saveAction,
        });
      } else {
        saveAction();
      }
    } else { // bulk mode
      const existing = this.state.savedBulkTemplates.find(t => t.name === name);
      if (isNew && existing) {
        this.setState({
          showConfirm: true,
          confirmMessage: `Template "${name}" already exists. Overwrite it?`,
          confirmAction: saveAction,
        });
      } else {
        saveAction();
      }
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
          isDirty: false,
        });
      } else {
        this.setState({ selectedSingleTemplate: '', isDirty: false });
      }
    } else { // bulk mode
      const template = this.state.savedBulkTemplates.find(t => t.name === name);
      if (template) {
        this.setState({
          bulkPrefix: template.prefix,
          bulkTemplate: template.template,
          bulkSuffix: template.suffix,
          selectedBulkTemplate: name,
          isDirty: false,
        });
      } else {
        this.setState({ selectedBulkTemplate: '', isDirty: false });
      }
    }
  }

  private deleteTemplate() {
    const mode = this.state.mode;
    const templateName = mode === 'single' ? this.state.selectedSingleTemplate : this.state.selectedBulkTemplate;

    if (!templateName) return;

    const deleteAction = () => {
      if (mode === 'single') {
        this.setState({
          savedSingleTemplates: this.state.savedSingleTemplates.filter(t => t.name !== templateName),
          selectedSingleTemplate: '',
          singleTemplate: '',
          showConfirm: false,
          isDirty: false,
        });
      } else { // bulk mode
        this.setState({
          savedBulkTemplates: this.state.savedBulkTemplates.filter(t => t.name !== templateName),
          selectedBulkTemplate: '',
          bulkPrefix: '',
          bulkTemplate: '',
          bulkSuffix: '',
          showConfirm: false,
          isDirty: false,
        });
      }
    };

    this.setState({
      showConfirm: true,
      confirmMessage: `Are you sure you want to delete "${templateName}"?`,
      confirmAction: deleteAction,
    });
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
        ${this.state.showConfirm ? `
          <div class="confirm-dialog-overlay">
            <div class="confirm-dialog">
              <p>${this.state.confirmMessage}</p>
              <div class="button-group">
                <button id="btn-confirm-action" class="primary-btn">Confirm</button>
                <button id="btn-cancel-action" class="secondary-btn">Cancel</button>
              </div>
            </div>
          </div>
        ` : ''}
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
                  <div class="radio-group mini">
                    <label class="radio-item"><input type="radio" name="joinType" value="newline" ${!this.state.bulkJoinInline ? 'checked' : ''}> New Line</label>
                    <label class="radio-item"><input type="radio" name="joinType" value="inline" ${this.state.bulkJoinInline ? 'checked' : ''}> Inline</label>
                  </div>
                </div>
                <div class="template-controls">
                    <select id="load-template-bulk" class="template-dropdown" ${this.state.isSaving ? 'disabled' : ''}>
                        <option value="">Load a template...</option>
                        ${this.state.savedBulkTemplates.map(t => `<option value="${t.name}" ${this.state.selectedBulkTemplate === t.name ? 'selected' : ''}>${t.name}</option>`).join('')}
                    </select>
                    <button id="btn-save-bulk" class="secondary-btn" ${this.state.isSaving || !this.state.isDirty ? 'disabled' : ''}>Save</button>
                    <button id="btn-save-as-bulk" class="secondary-btn" ${this.state.isSaving ? 'disabled' : ''}>Save As...</button>
                    <button id="btn-delete-template-bulk" class="delete-btn" ${!this.state.selectedBulkTemplate || this.state.isSaving ? 'style="display:none;"' : ''}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 1a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM4 3a1 1 0 0 0-1 1v1h10V4a1 1 0 0 0-1-1H4zm1 3v6a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V6H5zm2 1h1v4H7V7zm2 0h1v4H9V7z"/></svg>
                    </button>
                </div>
                <div class="template-name-input-container" ${!this.state.isSaving ? 'style="display:none;"' : ''}>
                    <input type="text" id="template-name-input-bulk" placeholder="Enter template name..." value="${this.state.templateNameInput}">
                    <button id="btn-confirm-save-bulk" class="primary-btn">Confirm</button>
                    <button id="btn-cancel-save-bulk" class="secondary-btn">Cancel</button>
                </div>
                <textarea id="input-bulk-template" class="${this.state.isDirty ? 'is-dirty' : ''}" placeholder="({{id}}, '{{name}}')">${this.state.bulkTemplate}</textarea>
              </div>
              <div class="panel">
                <label>Suffix</label>
                <textarea id="input-suffix" placeholder=";">${this.state.bulkSuffix}</textarea>
              </div>
            ` : `
              <div class="panel">
                <label>Template</label>
                <div class="template-controls">
                    <select id="load-template-single" class="template-dropdown" ${this.state.isSaving ? 'disabled' : ''}>
                        <option value="">Load a template...</option>
                        ${this.state.savedSingleTemplates.map(t => `<option value="${t.name}" ${this.state.selectedSingleTemplate === t.name ? 'selected' : ''}>${t.name}</option>`).join('')}
                    </select>
                    <button id="btn-save-single" class="secondary-btn" ${this.state.isSaving || !this.state.isDirty ? 'disabled' : ''}>Save</button>
                    <button id="btn-save-as-single" class="secondary-btn" ${this.state.isSaving ? 'disabled' : ''}>Save As...</button>
                    <button id="btn-delete-template-single" class="delete-btn" ${!this.state.selectedSingleTemplate || this.state.isSaving ? 'style="display:none;"' : ''}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 1a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM4 3a1 1 0 0 0-1 1v1h10V4a1 1 0 0 0-1-1H4zm1 3v6a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V6H5zm2 1h1v4H7V7zm2 0h1v4H9V7z"/></svg>
                    </button>
                </div>
                <div class="template-name-input-container" ${!this.state.isSaving ? 'style="display:none;"' : ''}>
                    <input type="text" id="template-name-input-single" placeholder="Enter template name..." value="${this.state.templateNameInput}">
                    <button id="btn-confirm-save-single" class="primary-btn">Confirm</button>
                    <button id="btn-cancel-save-single" class="secondary-btn">Cancel</button>
                </div>
                <textarea id="input-single-template" class="${this.state.isDirty ? 'is-dirty' : ''}" placeholder="curl -X POST ... -d '{\\"id\\": \\"{{id}}\\", \\"name\\": \\"{{name}}\\"}'">${this.state.singleTemplate}</textarea>
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

    const mode = this.state.mode;
    document.getElementById(`btn-save-${mode}`)?.addEventListener('click', () => this.saveTemplate(false));
    document.getElementById(`btn-save-as-${mode}`)?.addEventListener('click', () => this.saveTemplate(true));
    document.getElementById(`btn-delete-template-${mode}`)?.addEventListener('click', () => this.deleteTemplate());
    document.getElementById(`btn-confirm-save-${mode}`)?.addEventListener('click', () => this.confirmSave(this.state.templateNameInput, true));
    document.getElementById(`btn-cancel-save-${mode}`)?.addEventListener('click', () => this.setState({ isSaving: false, templateNameInput: '' }));

    document.getElementById(`template-name-input-${mode}`)?.addEventListener('input', (e) => {
      this.setState({ templateNameInput: (e.target as HTMLInputElement).value });
    });

    document.getElementById(`template-name-input-${mode}`)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.confirmSave(this.state.templateNameInput, true);
      } else if (e.key === 'Escape') {
        this.setState({ isSaving: false, templateNameInput: '' });
      }
    });

    document.getElementById(`load-template-${mode}`)?.addEventListener('change', (e) => {
      const selectedTemplate = (e.target as HTMLSelectElement).value;
      this.loadTemplate(selectedTemplate);
    });

    if (this.state.showConfirm) {
        document.getElementById('btn-confirm-action')?.addEventListener('click', () => {
            if (this.state.confirmAction) {
                this.state.confirmAction();
            }
        });
        document.getElementById('btn-cancel-action')?.addEventListener('click', () => {
            this.setState({ showConfirm: false, confirmMessage: '', confirmAction: null });
            this.render();
        });
    }

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

    const setupInputListener = (id: string, key: keyof AppState, clearSelection: boolean = false) => {
      const el = document.getElementById(id) as HTMLTextAreaElement;
      if (!el) {
        return;
      }
      el.addEventListener('input', (e) => {
        const val = (e.target as HTMLTextAreaElement).value;
        const newState: Partial<AppState> = { [key]: val, isDirty: true };
        if (clearSelection) {
          if (this.state.mode === 'single') {
            newState.selectedSingleTemplate = '';
          } else {
            newState.selectedBulkTemplate = '';
          }
        }
        this.setState(newState);
      });
    };

    setupInputListener('input-data', 'inputData', false);
    setupInputListener('input-prefix', 'bulkPrefix', true);
    setupInputListener('input-single-template', 'singleTemplate', true);
    setupInputListener('input-bulk-template', 'bulkTemplate', true);
    setupInputListener('input-suffix', 'bulkSuffix', true);

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
