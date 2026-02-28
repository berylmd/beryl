import type { FileAdapter } from '@repo/file-adapter'

export function createElectronAdapter(): FileAdapter {
  const api = (window as any).berylDesktop

  return {
    readFile: (path) =>
      api.readFile(path),

    writeFile: (path, content) =>
      api.writeFile(path, content),

    listFiles: (dir) =>
      api.listFiles(dir),

    watchDir: (dir, callback) => {
      api.watchDir(dir)
      api.onDirChanged((changedDir: string) => {
        if (changedDir === dir) callback()
      })
      return Promise.resolve(() => api.unwatchDir(dir))
    },

    pickDirectory: () =>
      api.pickDirectory(),
  }
}
