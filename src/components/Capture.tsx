import { useDeferredValue, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { previewCapture, useAddTask, useAddTasks, type CapturePreview } from '../assist/useAddTask'
import { findSimilar, guessSplit, splitLines } from '../lib/brainDump'
import { formatDue } from '../lib/dates'
import { REPEAT_LABEL } from '../model/repeat'
import { EFFORT_LABEL, type Area } from '../model/types'
import { areaStyle, useAreaMap, useMediaQuery, useNow } from '../hooks'
import { useStore } from '../store/useStore'
import { DuePill } from './DueDate'
import { Icon } from './Icon'
import './Capture.css'

interface CaptureProps {
  /** `hero` is the big box on Today; `sheet` sits in the New task dialog. */
  variant: 'hero' | 'sheet'
  /** Pre-select an area (e.g. when adding from an area page). */
  areaId?: string | null
  onAdded?: (id: string) => void
  autoFocus?: boolean
}

const HINT = 'Try “Finish lab report by Friday”'
/** Long enough for a pasted list; each line is still cut to a task title on save. */
const MAX_CHARS = 4000
/** Parsed brain-dump lines kept between keystrokes; cleared past this so typing can't grow it forever. */
const MAX_CACHED_LINES = 500
const KEYS_HINT = 'Enter adds, Shift+Enter for a new line.'
const TALL_SLACK_PX = 4
const FIELD_SIZING = typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content')

const parsedLines = new WeakMap<Area[], Map<string, CapturePreview | null>>()

/** A keystroke changes one line of a brain dump, so the other lines reuse their parse (per areas list and day). */
function previewLine(line: string, forced: string | null, areas: Area[], day: string): CapturePreview | null {
  let cache = parsedLines.get(areas)
  if (!cache || cache.size > MAX_CACHED_LINES) {
    cache = new Map()
    parsedLines.set(areas, cache)
  }
  const key = `${day}|${forced ?? ''}|${line}`
  if (!cache.has(key)) cache.set(key, previewCapture(line, forced, areas))
  return cache.get(key) ?? null
}

/**
 * A text box that grows. Enter saves immediately; area, date and priority are inferred and
 * shown as a quiet preview that can be corrected, but never has to be. Several lines (or a
 * pasted list) become a short list of tasks that Enter adds all at once.
 */
export function Capture({ variant, areaId = null, onAdded, autoFocus = false }: CaptureProps) {
  const [text, setText] = useState('')
  const [override, setOverride] = useState<string | null>(null)
  /** Said once by the status region after × drops a line. */
  const [removed, setRemoved] = useState<string | null>(null)
  const areas = useStore((s) => s.areas)
  const tasks = useStore((s) => s.tasks)
  const ai = useStore((s) => s.prefs.ai)
  const showToast = useStore((s) => s.showToast)
  const areaMap = useAreaMap()
  const phone = useMediaQuery('(max-width: 760px)')
  const add = useAddTask()
  const addMany = useAddTasks()
  const now = useNow()
  const forced = override ?? areaId
  const hintId = useId()
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const lines = useMemo(() => splitLines(text), [text])
  const single = lines.length === 1 ? (lines[0] ?? '') : ''
  const preview = useMemo(() => previewCapture(single, forced, areas), [single, forced, areas])
  const many = lines.length > 1
  const day = now.toDateString()
  // `index` points back into `lines` so × can drop exactly that line.
  const rows = useMemo(
    () =>
      many
        ? lines.flatMap((line, index) => {
            const row = previewLine(line, forced, areas, day)
            return row?.title.trim() ? [{ index, row }] : []
          })
        : [],
    [many, lines, forced, areas, day],
  )
  const split = useMemo(() => (single ? guessSplit(single) : null), [single])
  // Comparing against every task can lag on big lists; let typing win.
  const dupTitle = useDeferredValue(preview?.title ?? '')
  const duplicate = useMemo(() => findSimilar(dupTitle, tasks), [dupTitle, tasks])
  const area = preview ? areaMap.get(preview.areaId) : undefined

  // Grows with the text (where CSS can't) and squares off the pill once there is more than one line.
  const [tall, setTall] = useState(false)
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    if (!FIELD_SIZING) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
    setTall(el.scrollHeight > Number.parseFloat(getComputedStyle(el).minHeight) + TALL_SLACK_PX)
  }, [text])

  const reset = (): void => {
    setText('')
    setOverride(null)
    setRemoved(null)
  }

  const replaceText = (next: string): void => {
    setText(next)
    inputRef.current?.focus()
  }

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (many) {
      const ids = addMany(lines, forced)
      if (ids.length === 0) return
      reset()
      // The dialog lists newest first; add in reverse so the list reads in typed order.
      for (const id of [...ids].reverse()) onAdded?.(id)
      return
    }
    const id = add(single, forced)
    if (!id) return
    showToast(ai === 'off' ? `Added to ${area?.name ?? 'your tasks'}` : `Added. Cairn is sorting the details…`)
    reset()
    onAdded?.(id)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    // Safari's Enter that confirms an IME word has isComposing false but keyCode 229.
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    e.currentTarget.form?.requestSubmit()
  }

  const openDuplicate = (id: string): void => {
    const { view, navigate, select, setQuickAddOpen } = useStore.getState()
    if (view === 'focus' || view === 'reset') navigate({ view: 'tasks', mode: 'list' })
    if (variant === 'sheet') setQuickAddOpen(false)
    select(id)
  }

  const count = `${rows.length} ${rows.length === 1 ? 'task' : 'tasks'}`
  // maxLength cuts a long paste silently; say so.
  const atLimit = text.length >= MAX_CHARS
  const limitNote = `That’s the ${MAX_CHARS.toLocaleString()}-character limit, so the end of a long paste was left out.`
  // Short spoken summary; the preview itself holds controls, so it is not a live region.
  const summary = many
    ? count
    : preview
      ? [
          `Area ${area?.name ?? ''}`,
          preview.due && `due ${formatDue(preview.due, now)}`,
          duplicate && `already on your list as ‘${duplicate.title}’`,
        ]
          .filter(Boolean)
          .join(', ')
      : ''
  const status = [removed, summary, atLimit && limitNote].filter(Boolean).join('. ')

  return (
    <form className={`capture capture--${variant}`} onSubmit={submit} aria-label="Add a task">
      <div className={`capture__box${tall ? ' capture__box--multi' : ''}`}>
        <span className="capture__icon" aria-hidden="true">
          <Icon name={ai === 'off' ? 'plus' : 'sparkle'} size={variant === 'hero' ? 22 : 20} />
        </span>
        <textarea
          ref={inputRef}
          id={variant === 'hero' ? 'capture-input' : undefined}
          className="capture__input"
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setRemoved(null)
          }}
          onKeyDown={onKeyDown}
          placeholder={variant === 'hero' ? 'What’s on your mind?' : 'What do you need to do?'}
          aria-label="New task"
          aria-describedby={hintId}
          autoComplete="off"
          enterKeyHint="done"
          maxLength={MAX_CHARS}
          autoFocus={autoFocus}
          data-autofocus={autoFocus || undefined}
        />
        <button type="submit" className="btn btn--primary capture__submit" disabled={lines.length === 0}>
          {phone ? <Icon name="arrowRight" size={18} /> : many ? `Add ${rows.length}` : 'Add'}
          {phone && <span className="visually-hidden">{many ? `Add ${count}` : 'Add task'}</span>}
        </button>
      </div>
      <span className="visually-hidden" id={hintId}>
        {KEYS_HINT}
      </span>
      <span className="visually-hidden" role="status">
        {status}
      </span>
      <div className="capture__preview">
        {atLimit && <span className="capture__hint capture__limit">{limitNote}</span>}
        {many ? (
          <span className="capture__count">
            {count} <span className="capture__hint">· Enter adds them all</span>
          </span>
        ) : preview ? (
          <>
            <label className="capture__area" style={areaStyle(area)}>
              <span className="dot" />
              <select
                value={preview.areaId}
                onChange={(e) => setOverride(e.target.value)}
                aria-label={preview.guessed ? 'Area (guessed from your words)' : 'Area'}
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <Icon name="chevron" size={12} />
            </label>
            <Extras preview={preview} now={now} />
            {preview.effort && <span className="tag">{EFFORT_LABEL[preview.effort]}</span>}
            {split && (
              <button type="button" className="capture__chip" onClick={() => replaceText(split.join('\n'))}>
                Looks like {split.length} tasks · <strong>Split</strong>
              </button>
            )}
            {duplicate && (
              <span className="capture__dup">
                Already on your list: ‘{duplicate.title}’ ·{' '}
                <button type="button" className="capture__link" onClick={() => openDuplicate(duplicate.id)}>
                  Open
                </button>
              </span>
            )}
            {ai !== 'off' && !split && !duplicate && (
              <span className="capture__ai">
                <Icon name="sparkle" size={14} /> Steps, dates and order filled in for you
              </span>
            )}
          </>
        ) : (
          variant === 'hero' && <span className="capture__hint">{HINT}. Press Enter, that’s it.</span>
        )}
      </div>
      {many && (
        <ul className="capture__list" aria-label="Tasks to add">
          {rows.map(({ index, row }) => (
            <BrainDumpRow
              key={index} // by line position, so editing a line doesn't replay its entrance
              row={row}
              area={areaMap.get(row.areaId)}
              now={now}
              onDrop={() => {
                replaceText(lines.filter((_, j) => j !== index).join('\n'))
                setRemoved(`Removed ‘${row.title}’`)
              }}
            />
          ))}
        </ul>
      )}
    </form>
  )
}

/** Date, priority and repeat pills shared by the single preview and each brain-dump row. */
function Extras({ preview, now }: { preview: CapturePreview; now: Date }) {
  return (
    <>
      {preview.due && <DuePill due={preview.due} now={now} />}
      {preview.high && <span className="tag tag--high">High priority</span>}
      {preview.repeat && (
        <span className="tag">
          <Icon name="repeat" size={12} /> {REPEAT_LABEL[preview.repeat]}
        </span>
      )}
    </>
  )
}

interface BrainDumpRowProps {
  row: CapturePreview
  area: Area | undefined
  now: Date
  onDrop: () => void
}

function BrainDumpRow({ row, area, now, onDrop }: BrainDumpRowProps) {
  return (
    <li className="capture__row">
      <span className="capture__row-title">{row.title}</span>
      <span className="capture__row-meta">
        <span className="capture__row-area" style={areaStyle(area)}>
          <span className="dot" /> {area?.name}
        </span>
        <Extras preview={row} now={now} />
      </span>
      <button type="button" className="icon-btn capture__drop" onClick={onDrop} aria-label={`Don’t add “${row.title}”`}>
        <Icon name="close" size={14} />
      </button>
    </li>
  )
}
