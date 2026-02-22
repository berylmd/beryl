import type { FileAdapter } from '@beryl/file-adapter'
import { detectPlatform } from './platform.js'
import { createElectronAdapter } from './adapters/electron.js'
import { createCapacitorAdapter } from './adapters/capacitor.js'

const STORAGE_KEY = 'beryl:rootDir'

function createWorkspaceStore() {
  let fileAdapter = $state<FileAdapter | null>(null)
  let rootDir = $state<string | null>(null)
  let isReady = $state(false)

  function init() {
    // Pick the right adapter for this platform
    const platform = detectPlatform()
    if (platform === 'electron') {
      fileAdapter = createElectronAdapter()
    } else if (platform === 'capacitor') {
      fileAdapter = createCapacitorAdapter()
    }
    // 'browser' gets no adapter — the WorkspaceSetup screen handles this case

    // Restore last used folder from localStorage
    const saved = typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY)
      : null
    if (saved) rootDir = saved

    isReady = true
  }

  function setRootDir(dir: string) {
    rootDir = dir
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, dir)
    }
  }

  return {
    get fileAdapter() { return fileAdapter },
    get rootDir()     { return rootDir },
    get isReady()     { return isReady },
    get hasWorkspace(){ return rootDir !== null && fileAdapter !== null },
    init,
    setRootDir,
  }
}

export const workspace = createWorkspaceStore()