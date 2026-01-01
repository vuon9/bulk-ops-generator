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
    private readonly _context: vscode.ExtensionContext;
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

        BulkOpsPanel.currentPanel = new BulkOpsPanel(panel, context);
    }

    private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        this._panel = panel;
        this._extensionUri = context.extensionUri;
        this._context = context;

        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Send saved templates to the webview
        this._panel.webview.postMessage({
            command: 'loadTemplates',
            single: this._context.globalState.get('savedSingleTemplates', []),
            bulk: this._context.globalState.get('savedBulkTemplates', [])
        });

        this._panel.webview.onDidReceiveMessage(
            (message) => {
                switch (message.command) {
                    case 'alert':
                        vscode.window.showErrorMessage(message.text);
                        return;
                    case 'export':
                        this._exportToFile(message.text);
                        return;
                    case 'saveSingleTemplates':
                        this._context.globalState.update('savedSingleTemplates', message.templates);
                        return;
                    case 'saveBulkTemplates':
                        this._context.globalState.update('savedBulkTemplates', message.templates);
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
