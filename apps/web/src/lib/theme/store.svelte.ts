import { browser } from '$app/environment';

async function applyStatusBarStyle(isDark: boolean) {
  if (!browser) return;
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
  } catch {
    // not in a Capacitor context
  }
}

function createThemeStore() {
  let theme = $state<'light' | 'dark'>('light');

  function applyTheme(t: 'light' | 'dark') {
    if (!browser) return;
    document.documentElement.classList.toggle('dark', t === 'dark');
  }

  async function init() {
    if (!browser) return;
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = stored ?? (prefersDark ? 'dark' : 'light');
    applyTheme(theme);

    // Initialize Capacitor StatusBar: overlay the webview so we control the area
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light });
    } catch {
      // not in a Capacitor context
    }
  }

  function toggle() {
    theme = theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
    applyTheme(theme);
    applyStatusBarStyle(theme === 'dark');
  }

  return {
    get current() {
      return theme;
    },
    init,
    toggle,
  };
}

export const themeStore = createThemeStore();
