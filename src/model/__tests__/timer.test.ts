import { describe, expect, it } from 'vitest'
import { extend, finishTime, isFinished, pause, remainingMs, resume, start, workedMinutes } from '../timer'

const T0 = 1_000_000
const MIN = 60_000

describe('focus timer', () => {
  it('counts down from the end timestamp, not from ticks', () => {
    const t = start(T0, 15)
    expect(remainingMs(t, T0)).toBe(15 * MIN)
    expect(remainingMs(t, T0 + 10 * MIN)).toBe(5 * MIN)
    expect(isFinished(t, T0 + 15 * MIN)).toBe(true)
    expect(remainingMs(t, T0 + 20 * MIN)).toBe(0)
  })

  it('stops the clock while paused and picks up where it left off', () => {
    const paused = pause(start(T0, 5), T0 + 2 * MIN)
    expect(remainingMs(paused, T0 + 60 * MIN)).toBe(3 * MIN)
    const resumed = resume(paused, T0 + 60 * MIN)
    expect(remainingMs(resumed, T0 + 61 * MIN)).toBe(2 * MIN)
    expect(finishTime(resumed, T0 + 61 * MIN)).toBe(T0 + 63 * MIN)
  })

  it('extends a finished timer from now', () => {
    const t = extend(start(T0, 5), T0 + 7 * MIN, 5)
    expect(remainingMs(t, T0 + 7 * MIN)).toBe(5 * MIN)
    expect(isFinished(t, T0 + 7 * MIN)).toBe(false)
  })

  it('counts minutes worked, excluding pauses, rounded', () => {
    let t = start(T0, 25)
    t = pause(t, T0 + 10 * MIN)
    t = resume(t, T0 + 30 * MIN)
    expect(workedMinutes(t, T0 + 35 * MIN)).toBe(15)
    expect(workedMinutes(start(T0, 5), T0 + 6 * MIN)).toBe(5)
    expect(workedMinutes(start(T0, 5), T0 + 10_000)).toBe(0)
  })
})
