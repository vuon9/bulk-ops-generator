export interface PlatformAdapter {
  getState: () => any;
  setState: (state: any) => void;
  postMessage: (message: { command: string, text: any }) => void;
}
