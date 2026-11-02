// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OPTIONS, POST } from '../../api/[route]'

const req = (path: string, init: { origin?: string; method?: string; body?: string } = {}) =>
  new Request(`https://cairn.example${path}`, {
    method: init.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      host: 'cairn.example',
      'x-forwarded-for': '203.0.113.9, 10.0.0.1',
      ...(init.origin && { Origin: init.origin }),
    },
    body: init.method === 'OPTIONS' ? undefined : (init.body ?? '{}'),
  })

afterEach(() => vi.unstubAllEnvs())

describe('Vercel adapter (open access)', () => {
  it('allows its own origin and refuses others and scripts without an Origin', async () => {
    expect((await OPTIONS(req('/api/analyze', { method: 'OPTIONS', origin: 'https://cairn.example' }))).status).toBe(204)
    expect((await POST(req('/api/analyze', { origin: 'https://evil.example' }))).status).toBe(403)
    expect((await POST(req('/api/analyze'))).status).toBe(403)
  })

  it('needs no invite code: a request from its own page reaches validation', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
    expect((await POST(req('/api/analyze', { origin: 'https://cairn.example' }))).status).toBe(400)
  })

  it('says it is not set up when the key is missing', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const body = JSON.stringify({ ctx: { today: '2026-11-01', weekday: 'Sunday', areas: [], openTasks: [{ id: 't1', title: 'Call home', area: 'Life', due: null, priority: 'normal' }] } })
    const response = await POST(req('/api/plan', { origin: 'https://cairn.example', body }))
    expect(response.status).toBe(500)
    expect(((await response.json()) as { kind: string }).kind).toBe('config')
  })
})
