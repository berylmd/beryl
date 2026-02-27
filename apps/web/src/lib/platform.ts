type Platform = 'electron' | 'capacitor' | 'browser'

export function detectPlatform(): Platform {
  if (typeof (window as any).berylDesktop !== 'undefined') return 'electron'
  if (typeof (window as any).Capacitor !== 'undefined') return 'capacitor'
  return 'browser'
}