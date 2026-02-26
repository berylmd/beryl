
import type { FileAdapter } from '@repo/file-adapter'

export function createCapacitorAdapter(): FileAdapter {
  const notImplemented = (name: string) => () => {
    return Promise.reject(new Error(`Capacitor adapter: ${name} not yet implemented`))
  }

  return {
    readFile:     notImplemented('readFile') as FileAdapter['readFile'],
    writeFile:    notImplemented('writeFile') as FileAdapter['writeFile'],
    listFiles:    notImplemented('listFiles') as FileAdapter['listFiles'],
    watchDir:     notImplemented('watchDir') as FileAdapter['watchDir'],
    pickDirectory: notImplemented('pickDirectory') as FileAdapter['pickDirectory'],
  }
}
