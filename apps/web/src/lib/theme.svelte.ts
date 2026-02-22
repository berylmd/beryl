import { browser } from '$app/environment';

function createThemeStore() {
	let theme = $state<'light' | 'dark'>('light');

	function init() {
		if (!browser) return;
		const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		theme = stored ?? (prefersDark ? 'dark' : 'light');
		applyTheme(theme);
	}

	function applyTheme(t: 'light' | 'dark') {
		if (!browser) return;
		document.documentElement.classList.toggle('dark', t === 'dark');
	}

	function toggle() {
		theme = theme === 'light' ? 'dark' : 'light';
		localStorage.setItem('theme', theme);
		applyTheme(theme);
	}

	return {
		get current() {
			return theme;
		},
		init,
		toggle
	};
}

export const themeStore = createThemeStore();
