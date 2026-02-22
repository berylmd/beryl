/**
 * FileAdapter — the contract between the Beryl UI and the host platform.
 *
 * Electron: implemented via Node.js fs through Electron IPC
 * Capacitor: implemented via @capacitor/filesystem (stubbed for now)
 *
 * The UI never touches the filesystem directly. It always goes through this interface.
 */
export interface FileAdapter {
  /** Read a file as a UTF-8 string. Throw if not found. */
  readFile(path: string): Promise<string>

  /** Write a UTF-8 string to a file. Create if missing, overwrite if exists. */
  writeFile(path: string, content: string): Promise<void>

  /** List filenames in a directory. Non-recursive. Returns filenames only, not full paths. */
  listFiles(dir: string): Promise<string[]>

  /**
   * Watch a directory for changes. Call callback when anything changes.
   * Returns a cleanup function that stops watching.
   */
  watchDir(dir: string, callback: () => void): Promise<() => void>

  /**
   * Open a native folder picker. Returns the absolute path the user chose, or null if cancelled.
   * On mobile, returns a fixed path (Documents/Beryl) without showing a picker.
   */
  pickDirectory(): Promise<string | null>
}
