/**
 * Focus sounds engine: one module-wide player, so sound keeps going across views.
 * Looping buffers made once per kind (see buffers.ts), fades on start, stop and switch. Never throws:
 * where Web Audio is missing or blocked it simply stays silent.
 */
import { useSyncExternalStore } from 'react'
import type { NoiseKind } from '../types'
import { clampVolume, makeNoise, volumeToGain } from './buffers'

export const FADE_SECONDS = 0.4
/** Smoothing time constant for live volume changes. */
const VOLUME_GLIDE = 0.06
const CHANNELS = 2 // two independent channels sound wider and calmer than one

export interface SoundState {
  playing: boolean
  /** What plays (or would play next). */
  kind: NoiseKind
  /** "Stop after" choice in minutes; 0 is off. */
  stopAfterMin: number
  /** Epoch ms when the stop-after timer ends, while playing with a timer. */
  stopAt: number | null
}

interface Voice {
  src: AudioBufferSourceNode
  gain: GainNode
}

let state: SoundState = { playing: false, kind: 'pink', stopAfterMin: 0, stopAt: null }
let volume = 0.35
let ctx: AudioContext | null = null
let master: GainNode | null = null
let voice: Voice | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const buffers = new Map<NoiseKind, AudioBuffer>()
const listeners = new Set<() => void>()

export const soundAvailable = (): boolean => typeof AudioContext !== 'undefined'

function update(patch: Partial<SoundState>): void {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

/** The context and master gain, created on first use (from a click); null where audio is unavailable. */
function audio(): AudioContext | null {
  if (!soundAvailable()) return null
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = volumeToGain(volume)
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
  return ctx
}

function bufferFor(ac: AudioContext, kind: NoiseKind): AudioBuffer {
  const cached = buffers.get(kind)
  if (cached) return cached
  const first = makeNoise(kind, ac.sampleRate)
  const buffer = ac.createBuffer(CHANNELS, first.length, ac.sampleRate)
  buffer.getChannelData(0).set(first)
  for (let ch = 1; ch < CHANNELS; ch++) buffer.getChannelData(ch).set(makeNoise(kind, ac.sampleRate))
  buffers.set(kind, buffer)
  return buffer
}

function startVoice(ac: AudioContext, out: GainNode, kind: NoiseKind): void {
  const src = ac.createBufferSource()
  src.buffer = bufferFor(ac, kind)
  src.loop = true
  const gain = ac.createGain()
  const t = ac.currentTime
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(1, t + FADE_SECONDS)
  src.connect(gain).connect(out)
  src.start(t)
  voice = { src, gain }
}

function fadeOutVoice(ac: AudioContext): void {
  if (!voice) return
  const { src, gain } = voice
  voice = null
  const t = ac.currentTime
  gain.gain.cancelScheduledValues(t)
  gain.gain.setValueAtTime(gain.gain.value, t)
  gain.gain.linearRampToValueAtTime(0, t + FADE_SECONDS)
  src.onended = () => gain.disconnect()
  src.stop(t + FADE_SECONDS + 0.05)
}

/** (Re)starts the stop-after timer from now; returns when it ends, or null when off. */
function schedule(): number | null {
  clearTimeout(timer)
  if (state.stopAfterMin <= 0) return null
  const ms = state.stopAfterMin * 60_000
  timer = setTimeout(stop, ms)
  return Date.now() + ms
}

/** Starts `kind` (default: the last one) with a fade, or crossfades to it if another kind is playing. */
export function play(kind: NoiseKind = state.kind): void {
  if (state.playing && kind === state.kind) return
  try {
    const ac = audio()
    if (!ac || !master) return
    fadeOutVoice(ac)
    startVoice(ac, master, kind)
  } catch {
    return // Blocked or unsupported: stay silent and say so through isPlaying().
  }
  update({ playing: true, kind, stopAt: state.playing ? state.stopAt : schedule() })
}

/** Fades out and stops. Safe to call any time. */
export function stop(): void {
  clearTimeout(timer)
  try {
    if (ctx) fadeOutVoice(ctx)
  } catch {
    voice = null
  }
  if (state.playing || state.stopAt !== null) update({ playing: false, stopAt: null })
}

/** Picks the sound; crossfades if something is playing. */
export function setKind(kind: NoiseKind): void {
  if (state.playing) play(kind)
  else if (kind !== state.kind) update({ kind })
}

/** 0..1 (clamped). Glides there, so dragging the slider never clicks. */
export function setVolume(v: number): void {
  volume = clampVolume(v)
  try {
    if (ctx && master) master.gain.setTargetAtTime(volumeToGain(volume), ctx.currentTime, VOLUME_GLIDE)
  } catch {
    // Volume is best effort.
  }
}

export const getVolume = (): number => volume

/** Stop after this many minutes (0 = off). Counts from now if playing, else from the next play. */
export function setStopAfter(minutes: number): void {
  const stopAfterMin = Number.isFinite(minutes) ? Math.max(0, minutes) : 0
  state = { ...state, stopAfterMin }
  update({ stopAt: state.playing ? schedule() : null })
}

export const isPlaying = (): boolean => state.playing

/** What is playing right now ('none' when silent). Read when logging a Focus room block. */
export function currentSound(): NoiseKind | 'none' {
  return state.playing ? state.kind : 'none'
}

export const getSoundState = (): SoundState => state

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Live player state for React. */
export function useSound(): SoundState {
  return useSyncExternalStore(subscribe, getSoundState, getSoundState)
}
