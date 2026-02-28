// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

  /** Electron preload API exposed via contextBridge */
  interface BerylDesktopAPI {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    listFiles(dir: string): Promise<string[]>;
    watchDir(dir: string): Promise<void>;
    unwatchDir(dir: string): Promise<void>;
    onDirChanged(callback: (dir: string) => void): void;
    pickDirectory(): Promise<string | null>;
  }

  /** In-browser test adapter injected by Playwright via addInitScript */
  interface BerylTestAdapter {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    listFiles(dir: string): Promise<string[]>;
    watchDir(dir: string, callback: () => void): Promise<() => void>;
    pickDirectory(): Promise<string | null>;
    getFileContent(path: string): string | undefined;
    getWriteHistory(): Array<{ path: string; content: string }>;
    resetHistory(): void;
    setFile(path: string, content: string): void;
    notifyWatchers(): void;
  }

  interface Window {
    berylDesktop?: BerylDesktopAPI;
    Capacitor?: unknown;
    __BERYL_TEST_ADAPTER__?: BerylTestAdapter;
  }
}

export {};
