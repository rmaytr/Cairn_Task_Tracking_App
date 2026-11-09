/** Colour themes. Each id has a `[data-theme='id']` token block in src/themes.css. */
export const THEMES = [
  { id: 'stone', label: 'Stone', dark: false, color: '#eef0ec' },
  { id: 'notes', label: 'Notes', dark: false, color: '#f4efe4' },
  { id: 'moss', label: 'Moss', dark: false, color: '#e8eee4' },
  { id: 'contrast', label: 'Contrast', dark: false, color: '#ffffff' },
  { id: 'night', label: 'Night', dark: true, color: '#0d0e0d' },
  { id: 'dusk', label: 'Dusk', dark: true, color: '#110e18' },
  { id: 'ink', label: 'Ink', dark: true, color: '#000000' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']
export type ThemePref = 'system' | ThemeId

export const THEME_PREFS = ['system', 'stone', 'notes', 'moss', 'contrast', 'night', 'dusk', 'ink'] as const satisfies readonly ThemePref[]

/** "Match system" is Stone by day and Night by night. */
export const resolveTheme = (pref: ThemePref, systemDark: boolean): ThemeId =>
  pref === 'system' ? (systemDark ? 'night' : 'stone') : pref

export const TEXT_SIZES = ['default', 'large', 'larger'] as const
export type TextSize = (typeof TEXT_SIZES)[number]
