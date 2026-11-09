/** Tiny synthesized sounds and a haptic tick for finishing things. No audio files; never throws. */
export interface FeedbackPrefs {
  sound: boolean
  haptics: boolean
}

let ctx: AudioContext | null = null

/** One soft sine blip with a fast decay; `at` offsets it in seconds. */
function blip(frequency: number, at: number, length: number, gain: number): void {
  try {
    const Ctor = typeof AudioContext === 'undefined' ? undefined : AudioContext
    if (!Ctor) return
    ctx ??= new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
    const t = ctx.currentTime + at
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = frequency
    amp.gain.setValueAtTime(0.0001, t)
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.01)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + length)
    osc.connect(amp).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + length + 0.02)
  } catch {
    // Audio is a nicety: blocked or unsupported just means silence.
  }
}

/** The finishing "tock": a short low blip plus a 12ms haptic, each only if enabled. */
export function tock(prefs: FeedbackPrefs): void {
  if (prefs.sound) blip(420, 0, 0.12, 0.12)
  if (prefs.haptics) {
    try {
      navigator.vibrate?.(12)
    } catch {
      // Not all browsers allow it.
    }
  }
}

/** The timer's gentle two-note chime. The caller checks the sound preference. */
export function chime(): void {
  blip(523, 0, 0.5, 0.1)
  blip(784, 0.18, 0.7, 0.1)
}
