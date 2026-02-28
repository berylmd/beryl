import type { FileAdapter } from '@repo/file-adapter'

export function createElectronAdapter(): FileAdapter {
  const api = (window as any).berylDesktop

  // Register the IPC listener once. Route to the current active callback.
  let dirChangedCallback: ((dir: string) => void) | null = null
  api.onDirChanged((changedDir: string) => {
    dirChangedCallback?.(changedDir)
  })

  return {
    readFile: (path) =>
      api.readFile(path),

    writeFile: (path, content) =>
      api.writeFile(path, content),

    listFiles: (dir) =>
      api.listFiles(dir),

    watchDir: (dir, callback) => {
      api.watchDir(dir)
      dirChangedCallback = (changedDir: string) => {
        if (changedDir === dir) callback()
      }
      return Promise.resolve(() => {
        dirChangedCallback = null
        api.unwatchDir(dir)
      })
    },

    pickDirectory: () =>
      api.pickDirectory(),
  }
}
