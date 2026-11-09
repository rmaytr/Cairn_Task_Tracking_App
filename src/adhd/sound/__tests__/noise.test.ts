import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeContext, gains, sources } from './fakeAudio'

type Engine = typeof import('../noise')

async function load(withAudio: boolean): Promise<Engine> {
  vi.resetModules()
  sources.length = 0
  gains.length = 0
  if (withAudio) vi.stubGlobal('AudioContext', FakeContext)
  return import('../noise')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('without Web Audio (jsdom)', () => {
  it('stays silent and never throws', async () => {
    const e = await load(false)
    expect(e.soundAvailable()).toBe(false)
    expect(() => { e.play('brown'); e.setVolume(0.5); e.setKind('rain'); e.stop() }).not.toThrow()
    expect(e.isPlaying()).toBe(false)
    expect(e.currentSound()).toBe('none')
  })
})

describe('with Web Audio', () => {
  let e: Engine
  beforeEach(async () => {
    e = await load(true)
  })

  it('plays a looping source with a fade in, and reports it', async () => {
    const listener = vi.fn()
    e.subscribe(listener)
    e.play('pink')
    expect(e.isPlaying()).toBe(true)
    expect(e.currentSound()).toBe('pink')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(sources[0].loop).toBe(true)
    expect(sources[0].started).toBe(1)
    const fade = gains[1].gain.calls
    expect(fade).toEqual([['set', 0], ['ramp', 1]])
  })

  it('crossfades when the kind changes, and ignores a repeat play', () => {
    e.play('pink')
    e.play('pink')
    expect(sources).toHaveLength(1)
    e.setKind('rain')
    expect(sources).toHaveLength(2)
    expect(sources[0].stopped).toBe(1)
    expect(gains[1].gain.calls.at(-1)).toEqual(['ramp', 0])
    expect(e.currentSound()).toBe('rain')
  })

  it('stop fades out and notifies; unsubscribe stops notifications', () => {
    const listener = vi.fn()
    const off = e.subscribe(listener)
    e.play('brown')
    e.stop()
    expect(e.currentSound()).toBe('none')
    expect(sources[0].stopped).toBe(1)
    expect(listener).toHaveBeenCalledTimes(2)
    off()
    e.play()
    expect(listener).toHaveBeenCalledTimes(2)
    expect(e.currentSound()).toBe('brown') // play() with no kind resumes the last one
  })

  it('setKind while silent only changes what plays next', () => {
    e.setKind('white')
    expect(e.isPlaying()).toBe(false)
    expect(sources).toHaveLength(0)
    e.play()
    expect(e.currentSound()).toBe('white')
  })

  it('clamps volume and glides the master gain to the squared value', () => {
    e.play('pink')
    e.setVolume(4)
    expect(e.getVolume()).toBe(1)
    e.setVolume(0.5)
    expect(gains[0].gain.calls.at(-1)).toEqual(['target', 0.25])
  })

  it('stops by itself after the chosen minutes', () => {
    vi.useFakeTimers()
    e.setStopAfter(15)
    e.play('rain')
    expect(e.getSoundState().stopAt).toBeGreaterThan(Date.now())
    vi.advanceTimersByTime(15 * 60_000)
    expect(e.isPlaying()).toBe(false)
    expect(e.getSoundState().stopAt).toBeNull()
  })

  it('a blocked context leaves it silent instead of throwing', async () => {
    vi.resetModules()
    vi.stubGlobal('AudioContext', class { constructor() { throw new Error('blocked') } })
    const fresh = await import('../noise')
    expect(() => fresh.play('pink')).not.toThrow()
    expect(fresh.isPlaying()).toBe(false)
  })
})
