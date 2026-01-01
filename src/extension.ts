import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('bulk-ops-generator.open', () => {
            BulkOpsPanel.createOrShow(context);
        })
    );
}

class BulkOpsPanel {
    public static currentPanel: BulkOpsPanel | undefined;
    public static readonly viewType = 'bulkOpsGenerator';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(context: vscode.ExtensionContext) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (BulkOpsPanel.currentPanel) {
            BulkOpsPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            BulkOpsPanel.viewType,
            'Bulk Ops Generator',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
                retainContextWhenHidden: true,
            }
        );

        BulkOpsPanel.currentPanel = new BulkOpsPanel(panel, context.extensionUri);
    }

    private getTemplateFilePath(): vscode.Uri | undefined {
        const configPath = vscode.workspace.getConfiguration('bulk-ops-generator').get<string>('templateFilePath');
        if (!configPath) {
            return undefined;
        }
        if (vscode.workspace.workspaceFolders) {
            return vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, configPath);
        }
        return undefined;
    }

    private async loadTemplatesFromFile() {
        const templateFileUri = this.getTemplateFilePath();
        if (!templateFileUri) {
            return { single: [], bulk: [] };
        }
        try {
            const fileContent = await vscode.workspace.fs.readFile(templateFileUri);
            const templates = JSON.parse(Buffer.from(fileContent).toString('utf8'));
            return {
                single: templates.single || [],
                bulk: templates.bulk || [],
            };
        } catch (_error) {
            // File might not exist yet, which is fine.
            return { single: [], bulk: [] };
        }
    }

    private async saveTemplatesToFile(templates: { single: any[], bulk: any[] }) {
        const templateFileUri = this.getTemplateFilePath();
        if (!templateFileUri) {
            vscode.window.showErrorMessage('No template file path is configured. Please set "bulk-ops-generator.templateFilePath" in your settings.');
            return;
        }
        try {
            const content = JSON.stringify(templates, null, 2);
            await vscode.workspace.fs.writeFile(templateFileUri, Buffer.from(content, 'utf8'));
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to save templates: ${error.message}`);
        }
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Load templates and send to webview
        this.loadTemplatesFromFile().then(templates => {
            this._panel.webview.postMessage({
                command: 'loadTemplates',
                ...templates
            });
        });

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'alert':
                        vscode.window.showErrorMessage(message.text);
                        return;
                    case 'export':
                        this._exportToFile(message.text);
                        return;
                    case 'saveSingleTemplates':
                    case 'saveBulkTemplates':
                        const currentTemplates = await this.loadTemplatesFromFile();
                        const newTemplates = {
                            single: message.command === 'saveSingleTemplates' ? message.templates : currentTemplates.single,
                            bulk: message.command === 'saveBulkTemplates' ? message.templates : currentTemplates.bulk,
                        };
                        await this.saveTemplatesToFile(newTemplates);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private async _exportToFile(content: string) {
        const options: vscode.SaveDialogOptions = {
            saveLabel: 'Export Output',
            filters: {
                'All files': ['*']
            }
        };

        const fileUri = await vscode.window.showSaveDialog(options);
        if (fileUri) {
            try {
                await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
                vscode.window.showInformationMessage('Successfully exported to file.');
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to export: ${error.message}`);
            }
        }
    }

    public dispose() {
        BulkOpsPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.title = 'Bulk Ops Generator';
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'style.css'));

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <title>Bulk Ops Generator</title>
</head>
<body>
    <div id="app"></div>
    <script src="${scriptUri}"></script>
</body>
</html>`;
    }
}
