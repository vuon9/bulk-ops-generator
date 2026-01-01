import { PlatformAdapter } from './platform';

export const webPlatform: PlatformAdapter = {
  getState: (): any => {
    const state = localStorage.getItem('vscodeState');
    if (state) {
      return JSON.parse(state);
    }
  },
  setState: (state: any): void => {
    localStorage.setItem('vscodeState', JSON.stringify(state));
  },
  postMessage: (message: { command: string, text: any }): void => {
    if (message.command === 'export') {
      const blob = new Blob([message.text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'output.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  },
};
