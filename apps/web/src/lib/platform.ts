type Platform = 'electron' | 'capacitor' | 'browser';

export function detectPlatform(): Platform {
  if ('berylDesktop' in window) return 'electron';
  if ('Capacitor' in window) return 'capacitor';
  return 'browser';
}
