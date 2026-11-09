import { useStore } from '../store/useStore'
import { Dialog } from './Dialog'
import './QuickFind.css'

const ROWS: { keys: string[]; what: string; single?: boolean }[] = [
  { keys: ['⌘/Ctrl', 'K'], what: 'Command palette' },
  { keys: ['/'], what: 'Add a task', single: true },
  { keys: ['n'], what: 'Add a task', single: true },
  { keys: ['1'], what: 'Today', single: true },
  { keys: ['2'], what: 'Tasks', single: true },
  { keys: ['3'], what: 'Lock in', single: true },
  { keys: ['i'], what: 'Import', single: true },
  { keys: ['z'], what: 'Undo', single: true },
  { keys: ['Esc'], what: 'Close the open task or dialog' },
  { keys: ['Alt', '↑ / ↓'], what: 'Move a row' },
  { keys: ['?'], what: 'This list', single: true },
]

export function ShortcutsSheet() {
  const open = useStore((s) => s.shortcutsOpen)
  const setOpen = useStore((s) => s.setShortcutsOpen)
  const singleKeys = useStore((s) => s.prefs.shortcuts)
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Keyboard shortcuts">
      <div className="dialog__body">
        {!singleKeys && <p className="find__hint">Single-key shortcuts are off in Settings. Only the ones with modifiers work.</p>}
        <dl className="keys">
          {ROWS.map((r) => (
            <div key={r.keys.join('+') + r.what} className={`keys__row${r.single && !singleKeys ? ' is-off' : ''}`}>
              <dt>
                {r.keys.map((k) => (
                  <span key={k} className="kbd">
                    {k}
                  </span>
                ))}
              </dt>
              <dd>{r.what}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Dialog>
  )
}
