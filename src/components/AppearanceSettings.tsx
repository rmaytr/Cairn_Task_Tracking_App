import { THEMES, resolveTheme, type TextSize, type ThemeId, type ThemePref } from '../model/themes'
import { useStore } from '../store/useStore'
import { Icon } from './Icon'
import './AppearanceSettings.css'

const OPTIONS: readonly { id: ThemePref; label: string }[] = [{ id: 'system', label: 'Match system' }, ...THEMES]

const TEXT_SIZE_LABELS: readonly [TextSize, string][] = [
  ['default', 'Default'],
  ['large', 'Large'],
  ['larger', 'Larger'],
]

/** A tiny sheet painted with one theme's own tokens (data-theme scopes them to this element). */
function Preview({ theme }: { theme: ThemeId }) {
  return (
    <span className="theme-preview" data-theme={theme}>
      <span className="theme-preview__sheet">
        <span className="theme-preview__title" />
        <span className="theme-preview__row">
          <span className="theme-preview__check" />
          <span className="theme-preview__line" />
        </span>
        <span className="theme-preview__chip" />
      </span>
    </span>
  )
}

/**
 * Theme cards are native radios, so arrow keys move between them and screen readers announce
 * "radio, 3 of 8" for free; the input is visually hidden and the card shows focus and selection.
 */
export function AppearanceSettings() {
  const theme = useStore((s) => s.prefs.theme)
  const textSize = useStore((s) => s.prefs.textSize)
  const setPrefs = useStore((s) => s.setPrefs)

  return (
    <section>
      <h3>Appearance</h3>
      <fieldset className="theme-picker">
        <legend className="visually-hidden">Theme</legend>
        {OPTIONS.map((option) => (
          <label key={option.id} className="theme-card">
            <input
              type="radio"
              name="theme"
              className="visually-hidden"
              value={option.id}
              checked={theme === option.id}
              onChange={() => setPrefs({ theme: option.id })}
            />
            {option.id === 'system' ? (
              <span className="theme-card__split" aria-hidden="true">
                <Preview theme={resolveTheme('system', false)} />
                <Preview theme={resolveTheme('system', true)} />
              </span>
            ) : (
              <span aria-hidden="true">
                <Preview theme={option.id} />
              </span>
            )}
            {theme === option.id && (
              <span className="theme-card__badge" aria-hidden="true">
                <Icon name="check" size={12} />
              </span>
            )}
            <span className="theme-card__label">{option.label}</span>
          </label>
        ))}
      </fieldset>
      <div className="appearance__size">
        <span id="text-size-label">Text size</span>
        <div className="seg" role="group" aria-labelledby="text-size-label">
          {TEXT_SIZE_LABELS.map(([size, label]) => (
            <button key={size} type="button" aria-pressed={textSize === size} onClick={() => setPrefs({ textSize: size })}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
