import { useEffect, useState } from 'react'
import { isFinished, isPaused, type FocusTimer } from '../../model/timer'

/**
 * The current time, repainted every second while the timer runs. Time itself comes from the
 * timer's end timestamp; this only redraws. The setter lets a tap move `now` along with the change.
 */
export function useTick(timer: FocusTimer): [number, (at: number) => void] {
  const [now, setNow] = useState(() => Date.now())
  const running = !isPaused(timer) && !isFinished(timer, now)
  useEffect(() => {
    if (!running) return
    const refresh = (): void => setNow(Date.now())
    refresh()
    const id = setInterval(refresh, 1000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [running])
  return [now, setNow]
}
