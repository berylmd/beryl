import type { FileAdapter } from '@repo/file-adapter'
import { detectPlatform } from '$lib/platform.js'
import { createElectronAdapter } from './adapters/electron.js'
import { createCapacitorAdapter } from './adapters/capacitor.js'

const STORAGE_KEY = 'beryl:rootDir'

function createWorkspaceStore() {
  let fileAdapter = $state<FileAdapter | null>(null)
  let rootDir = $state<string | null>(null)
  let isReady = $state(false)

  function init() {
    // Check for test adapter first (injected by Playwright tests)
    // This must be checked BEFORE platform detection
    if (typeof window !== 'undefined') {
      const testAdapter = (window as any).__BERYL_TEST_ADAPTER__
      if (testAdapter) {
        // console.log('[Workspace] Using test adapter')
        fileAdapter = testAdapter
        rootDir = '/test-workspace'
        isReady = true
        return
      }
      
      // Check if we have a saved directory but no adapter (browser mode)
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && !fileAdapter) {
        // Clear invalid saved state
        localStorage.removeItem(STORAGE_KEY)
      }
    }

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
