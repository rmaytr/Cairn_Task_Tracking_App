/** Just enough of Web Audio to drive the engine and record what it scheduled. Not a test file. */
export class FakeParam {
  value = 1
  calls: [string, number][] = []
  setValueAtTime(v: number): void { this.calls.push(['set', v]) }
  linearRampToValueAtTime(v: number): void { this.calls.push(['ramp', v]) }
  setTargetAtTime(v: number): void { this.calls.push(['target', v]) }
  cancelScheduledValues(): void {}
}
export class FakeNode {
  gain = new FakeParam()
  connect<T>(next: T): T { return next }
  disconnect(): void {}
}
export class FakeSource extends FakeNode {
  buffer: unknown = null
  loop = false
  started = 0
  stopped = 0
  onended: (() => void) | null = null
  start(): void { this.started++ }
  stop(): void { this.stopped++ }
}
export const sources: FakeSource[] = []
export const gains: FakeNode[] = []
export class FakeContext {
  state = 'running'
  sampleRate = 8000
  currentTime = 0
  destination = new FakeNode()
  createGain(): FakeNode { const g = new FakeNode(); gains.push(g); return g }
  createBufferSource(): FakeSource { const s = new FakeSource(); sources.push(s); return s }
  createBuffer(channels: number, length: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length))
    return { getChannelData: (ch: number) => data[ch] }
  }
  resume(): Promise<void> { return Promise.resolve() }
}
