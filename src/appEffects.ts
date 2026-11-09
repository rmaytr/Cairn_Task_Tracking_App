import { useEffect } from 'react'
import { proxyAvailable, resetTransport, saveInvite } from './assist/assistant'
import { initCloud } from './cloud/controller'
import { useMediaQuery } from './hooks'
import { tock } from './lib/feedback'
import { onStorageError } from './store/persist'
import { parseHash } from './route'
import { currentHash, useStore, type View } from './store/useStore'

export const VIEW_TITLE: Record<View, string> = {
  home: 'Today',
  tasks: 'Tasks',
  focus: 'Lock in',
  reset: 'Weekly reset',
}

const SHORTCUT_VIEWS: readonly View[] = ['home', 'tasks', 'focus']

/** Applies the chosen or system theme to <html data-theme> and the browser chrome color. */
export function useTheme(): void {
  const theme = useStore((s) => s.prefs.theme)
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
  useEffect(() => {
    document.documentElement.dataset.theme = resolved
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', resolved === 'dark' ? '#0e1412' : '#eef3f0')
  }, [resolved])
}

/** A soft tock and haptic whenever a task is completed, wherever that happens. */
export function useFinishFeedback(): void {
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (s.lastCompleted && s.lastCompleted !== prev.lastCompleted) tock(s.prefs.feedback)
      }),
    [],
  )
}

/** Mirrors the route in location.hash so refresh and the back button behave. */
export function useHashView(): void {
  const hash = useStore(currentHash)
  const navigate = useStore((s) => s.navigate)
  const view = useStore((s) => s.view)
  const areaName = useStore((s) => s.areas.find((a) => a.id === s.areaFilter)?.name)

  useEffect(() => {
    const read = (): void => navigate(parseHash(location.hash))
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [navigate])

  useEffect(() => {
    document.title = `${areaName ?? VIEW_TITLE[view]} · Cairn`
    if (location.hash === hash) return
    if (location.hash) history.pushState(null, '', hash)
    else history.replaceState(null, '', hash)
  }, [hash, view, areaName])
}

export const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

export const isModalOpen = (): boolean => document.querySelector('dialog[open]') !== null

/** Global single-key shortcuts; ignored while typing or when a modal dialog is open. */
export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      // Ctrl/Cmd+K works everywhere, even while typing, like in most apps.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (!isModalOpen()) useStore.getState().setQuickFindOpen(true)
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      if (isModalOpen()) return
      const s = useStore.getState()
      if (!s.prefs.shortcuts) return
      if (e.key === '/' || e.key === 'n') {
        e.preventDefault()
        const inline = document.getElementById('capture-input')
        if (inline) inline.focus()
        else s.setQuickAddOpen(true)
      } else if (e.key >= '1' && e.key <= String(SHORTCUT_VIEWS.length)) {
        s.navigate({ view: SHORTCUT_VIEWS[Number(e.key) - 1], area: null })
      } else if (e.key === 'i') {
        s.setImportOpen(true)
      } else if (e.key === 'Escape' && s.selectedId) {
        s.select(null)
      } else if (e.key === '?') {
        s.setShortcutsOpen(true)
      } else if (e.key === 'z' && s.undoSnapshot) {
        s.undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/** Starts cloud sync (if this build has it) once local data has loaded. */
export function useCloud(): void {
  const hydrated = useStore((s) => s.hydrated)
  useEffect(() => {
    if (hydrated) void initCloud()
  }, [hydrated])
}

export function useStorageErrors(): void {
  useEffect(() => onStorageError((message) => useStore.getState().showToast(message, false, true)), [])
}

/**
 * A friend's share link (`/?invite=CODE`): save the code on this device, switch the assistant to
 * invite mode and take the code out of the address bar so it isn't bookmarked or shared further.
 */
export function useInviteLink(): void {
  const hydrated = useStore((s) => s.hydrated)
  useEffect(() => {
    if (!hydrated) return
    const url = new URL(location.href)
    const code = url.searchParams.get('invite')?.trim()
    if (!code) return
    url.searchParams.delete('invite')
    history.replaceState(history.state, '', url.pathname + url.search + url.hash)
    if (!proxyAvailable || code.length > 200) return
    void saveInvite(code).then(() => {
      resetTransport()
      const { setPrefs, showToast } = useStore.getState()
      setPrefs({ ai: 'proxy' })
      showToast('You’re in the beta. The assistant is on.')
    })
  }, [hydrated])
}
