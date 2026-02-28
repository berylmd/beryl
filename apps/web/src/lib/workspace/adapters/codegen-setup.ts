/**
 * Codegen adapter — active only when VITE_CODEGEN=true.
 *
 * Sets window.__BERYL_TEST_ADAPTER__ before workspace.init() runs so the app
 * loads with fake data instead of showing the folder picker.
 *
 * Usage:
 *   Terminal 1: pnpm dev:codegen
 *   Terminal 2: pnpm test:codegen http://localhost:5173
 *
 * Vite replaces import.meta.env.VITE_CODEGEN at build time — this entire
 * block is dead code in production builds and gets tree-shaken away.
 */
if (import.meta.env.VITE_CODEGEN === 'true' && typeof window !== 'undefined') {
  const files = new Map<string, string>([
    ['/test-workspace/inbox.md',    '- [ ] Buy groceries due:2026-03-01\n- [x] Call mom\n- [ ] Finish report\n'],
    ['/test-workspace/work.md',     '- [ ] Review PR\n- [ ] Update docs\n- [ ] Team standup due:2026-02-28\n'],
    ['/test-workspace/personal.md', '- [ ] Book dentist\n- [ ] Plan weekend\n'],
  ])

  const watchCallbacks = new Set<() => void>()

  ;(window as any).__BERYL_TEST_ADAPTER__ = {
    async readFile(path: string): Promise<string> {
      const content = files.get(path)
      if (content === undefined) throw new Error(`Codegen adapter: file not found: ${path}`)
      return content
    },

    async writeFile(path: string, content: string): Promise<void> {
      files.set(path, content)
      watchCallbacks.forEach((cb) => cb())
    },

    async listFiles(dir: string): Promise<string[]> {
      const prefix = dir.endsWith('/') ? dir : dir + '/'
      return [...files.keys()]
        .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
        .map((p) => p.slice(prefix.length))
    },

    async watchDir(_dir: string, callback: () => void): Promise<() => void> {
      watchCallbacks.add(callback)
      return () => watchCallbacks.delete(callback)
    },

    async pickDirectory(): Promise<string> {
      return '/test-workspace'
    },
  }

  console.log('[beryl] Codegen adapter active — fake workspace at /test-workspace')
}
