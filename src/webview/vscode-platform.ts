import { PlatformAdapter } from './platform';

declare const acquireVsCodeApi: () => any;
const vscode = acquireVsCodeApi();

export const vscodePlatform: PlatformAdapter = {
  getState: (): any => vscode.getState(),
  setState: (state: any): void => vscode.setState(state),
  postMessage: (message: { command: string, text: any }): void => {
    vscode.postMessage(message);
  },
};
