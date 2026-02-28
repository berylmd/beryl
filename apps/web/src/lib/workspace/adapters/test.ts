import type { FileAdapter } from '@repo/file-adapter';

/**
 * TestFileAdapter - A mock FileAdapter for Playwright tests.
 *
 * This adapter allows tests to:
 * 1. Set a starting file state (pre-populate files)
 * 2. Track writes to verify ending state
 * 3. Simulate file watcher events
 *
 * Usage:
 * 1. In your Playwright test, create a TestFileAdapter and configure initial files
 * 2. Inject it via window.__BERYL_TEST_ADAPTER__ before navigating to the app
 * 3. After UI interactions, verify the final state via getFileContents()
 */
export class TestFileAdapter implements FileAdapter {
  private files: Map<string, string> = new Map();
  private writeHistory: Array<{ path: string; content: string }> = [];
  private watchCallbacks: Set<() => void> = new Set();
  private rootDir: string = '/test-workspace';

  constructor(initialFiles?: Record<string, string>) {
    if (initialFiles) {
      for (const [path, content] of Object.entries(initialFiles)) {
        this.files.set(path, content);
      }
    }
  }

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
    this.writeHistory.push({ path, content });

    // Trigger watch callbacks to simulate file system change
    this.notifyWatchers();
  }

  async listFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    for (const path of this.files.keys()) {
      // Handle both absolute and relative paths
      const normalizedDir = dir.endsWith('/') ? dir : dir + '/';
      if (path.startsWith(normalizedDir)) {
        const relativePath = path.slice(normalizedDir.length);
        // Only return top-level files (not nested)
        if (!relativePath.includes('/')) {
          files.push(relativePath);
        }
      }
    }
    return files;
  }

  async watchDir(dir: string, callback: () => void): Promise<() => void> {
    this.watchCallbacks.add(callback);

    // Return cleanup function
    return () => {
      this.watchCallbacks.delete(callback);
    };
  }

  async pickDirectory(): Promise<string | null> {
    return this.rootDir;
  }

  // Test-specific methods (not part of FileAdapter interface)

  /** Get the content of a specific file */
  getFileContent(path: string): string | undefined {
    return this.files.get(path);
  }

  /** Get all file contents as a record */
  getAllFiles(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [path, content] of this.files.entries()) {
      result[path] = content;
    }
    return result;
  }

  /** Get the history of all write operations */
  getWriteHistory(): Array<{ path: string; content: string }> {
    return [...this.writeHistory];
  }

  /** Manually trigger watch callbacks (useful for simulating external changes) */
  notifyWatchers(): void {
    for (const callback of this.watchCallbacks) {
      callback();
    }
  }

  /** Set the root directory (for pickDirectory) */
  setRootDir(dir: string): void {
    this.rootDir = dir;
  }

  /** Add or update a file directly */
  setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  /** Clear all files */
  clear(): void {
    this.files.clear();
    this.writeHistory = [];
  }

  /** Reset write history but keep files */
  resetHistory(): void {
    this.writeHistory = [];
  }

  /** Serialize internal state for injection into browser context */
  serialize(): SerializedTestAdapter {
    return {
      files: Array.from(this.files.entries()),
      rootDir: this.rootDir,
    };
  }
}

/**
 * Serialized form of TestFileAdapter for passing through addInitScript
 */
export interface SerializedTestAdapter {
  files: [string, string][];
  rootDir: string;
}
/**
 * Setup the test adapter in the browser context for Playwright tests.
 * Call this in your test's beforeEach or addInitScript.
 *
 * @param page - Playwright page object
 * @param initialFiles - Record of path -> content for initial file state
 * @param rootDir - The root directory to return from pickDirectory (default: /test-workspace)
 */
export async function setupTestAdapter(
  page: import('@playwright/test').Page,
  initialFiles: Record<string, string>,
  rootDir: string = '/test-workspace'
): Promise<void> {
  const adapter = new TestFileAdapter(initialFiles);
  adapter.setRootDir(rootDir);
  const serialized = adapter.serialize();

  await page.addInitScript((serialized) => {
    const files = new Map(serialized.files);
    const writeHistory: Array<{ path: string; content: string }> = [];
    const watchCallbacks: Set<() => void> = new Set();
    const rootDir = serialized.rootDir;

    const adapter = {
      async readFile(path: string): Promise<string> {
        const content = files.get(path);
        if (content === undefined) {
          throw new Error(`File not found: ${path}`);
        }
        return content;
      },

      async writeFile(path: string, content: string): Promise<void> {
        files.set(path, content);
        writeHistory.push({ path, content });
        for (const callback of watchCallbacks) {
          callback();
        }
      },

      async listFiles(dir: string): Promise<string[]> {
        const result: string[] = [];
        const normalizedDir = dir.endsWith('/') ? dir : dir + '/';
        for (const path of files.keys()) {
          if (path.startsWith(normalizedDir)) {
            const relativePath = path.slice(normalizedDir.length);
            if (!relativePath.includes('/')) {
              result.push(relativePath);
            }
          }
        }
        return result;
      },

      async watchDir(dir: string, callback: () => void): Promise<() => void> {
        watchCallbacks.add(callback);
        return () => {
          watchCallbacks.delete(callback);
        };
      },

      async pickDirectory(): Promise<string | null> {
        return rootDir;
      },

      getFileContent(path: string): string | undefined {
        return files.get(path);
      },

      getWriteHistory(): Array<{ path: string; content: string }> {
        return [...writeHistory];
      },

      setFile(path: string, content: string): void {
        files.set(path, content);
        for (const callback of watchCallbacks) {
          callback();
        }
      },

      resetHistory(): void {
        writeHistory.length = 0;
      },

      notifyWatchers(): void {
        for (const callback of watchCallbacks) {
          callback();
        }
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__BERYL_TEST_ADAPTER__ = adapter;
  }, serialized);
}

/**
 * Get the current file content from the browser's test adapter.
 * Use this to verify the final state after UI interactions.
 *
 * @param page - Playwright page object
 * @param path - File path to read
 * @returns The file content or undefined if not found
 */
export async function getFileContent(
  page: import('@playwright/test').Page,
  path: string
): Promise<string | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return page.evaluate((p) => (window as any).__BERYL_TEST_ADAPTER__?.getFileContent(p), path);
}

/**
 * Get the write history from the browser's test adapter.
 * Use this to verify that writes occurred.
 *
 * @param page - Playwright page object
 * @returns Array of { path, content } objects representing write operations
 */
export async function getWriteHistory(
  page: import('@playwright/test').Page
): Promise<Array<{ path: string; content: string }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return page.evaluate(() => (window as any).__BERYL_TEST_ADAPTER__?.getWriteHistory());
}

/**
 * Reset the write history in the browser's test adapter.
 * Call this before making changes you want to track.
 *
 * @param page - Playwright page object
 */
export async function resetWriteHistory(page: import('@playwright/test').Page): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return page.evaluate(() => (window as any).__BERYL_TEST_ADAPTER__?.resetHistory());
}

/**
 * Simulate an external file change in the browser's test adapter.
 * This triggers the file watcher callbacks.
 *
 * @param page - Playwright page object
 * @param path - File path to update
 * @param content - New content for the file
 */
export async function setFileContent(
  page: import('@playwright/test').Page,
  path: string,
  content: string
): Promise<void> {
   
  return page.evaluate(
    ([path, content]) => (window as any).__BERYL_TEST_ADAPTER__?.setFile(path, content),
    [path, content]
  );
}
