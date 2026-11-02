// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OPTIONS, POST } from '../../api/[route]'

const req = (path: string, init: { origin?: string; host?: string; invite?: string; method?: string } = {}) =>
  new Request(`https://cairn.example${path}`, {
    method: init.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      host: init.host ?? 'cairn.example',
      ...(init.origin && { Origin: init.origin }),
      ...(init.invite && { 'X-Cairn-Invite': init.invite }),
    },
    body: init.method === 'OPTIONS' ? undefined : '{}',
  })

afterEach(() => vi.unstubAllEnvs())

describe('Vercel adapter', () => {
  it('allows its own origin by default and refuses others', async () => {
    vi.stubEnv('INVITE_CODES', 'friend-code-0001-abcd')
    expect((await OPTIONS(req('/api/analyze', { method: 'OPTIONS', origin: 'https://cairn.example' }))).status).toBe(204)
    expect((await POST(req('/api/analyze', { origin: 'https://evil.example', invite: 'friend-code-0001-abcd' }))).status).toBe(403)
  })

  it('rejects a wrong invite code', async () => {
    vi.stubEnv('INVITE_CODES', 'friend-code-0001-abcd')
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
    expect((await POST(req('/api/analyze', { origin: 'https://cairn.example', invite: 'guess-guess-guess-1' }))).status).toBe(401)
  })

  it('says it is not set up when the key or codes are missing', async () => {
    vi.stubEnv('INVITE_CODES', '')
    const response = await POST(req('/api/plan', { origin: 'https://cairn.example', invite: 'friend-code-0001-abcd' }))
    expect(response.status).toBe(500)
    expect(((await response.json()) as { kind: string }).kind).toBe('config')
  })
})
