/*
 * Vercel Functions entry for the assistant proxy: POST /api/analyze and /api/plan.
 * It reuses the Cloudflare Worker's handler (invite codes, failed-code throttle, per-code
 * daily limits, body cap, Zod validation); only the platform glue lives here.
 *
 * Env (Vercel project settings): ANTHROPIC_API_KEY, INVITE_CODES (comma-separated, 16+ chars),
 * optional MODEL, DAILY_LIMIT, ALLOWED_ORIGINS (defaults to this deployment's own origin).
 */
// Relative imports on this server path carry `.js`: Vercel runs them as plain Node ES modules.
import { handle, type Env, type KvLike } from '../worker/src/handler.js'

/**
 * shortcut: counters live in this function instance's memory, so they reset on cold starts and
 * aren't shared across instances (fine for a small private beta, with an Anthropic spend limit as
 * the hard stop). Upgrade to Upstash Redis (Vercel Marketplace) for strict limits.
 */
class MemoryKv implements KvLike {
  private readonly store = new Map<string, { value: string; expires: number }>()

  async get(key: string): Promise<string | null> {
    const hit = this.store.get(key)
    if (!hit) return null
    if (hit.expires < Date.now()) {
      this.store.delete(key)
      return null
    }
    return hit.value
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    if (this.store.size > 10_000) this.store.clear()
    this.store.set(key, { value, expires: Date.now() + (options?.expirationTtl ?? 86_400) * 1000 })
  }
}

const kv = new MemoryKv()

function env(request: Request): Env {
  const host = request.headers.get('host')
  return {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    INVITE_CODES: process.env.INVITE_CODES,
    MODEL: process.env.MODEL,
    DAILY_LIMIT: process.env.DAILY_LIMIT,
    // The app calls this from its own origin, which differs per preview deployment.
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? (host ? `https://${host}` : ''),
    RATE_KV: kv,
  }
}

// Vercel puts the client address here; the handler keys its failed-code throttle on this header.
function withClientIp(request: Request): Request {
  const ip = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (!ip) return request
  const headers = new Headers(request.headers)
  headers.set('CF-Connecting-IP', ip)
  return new Request(request, { headers })
}

export function POST(request: Request): Promise<Response> {
  return handle(withClientIp(request), env(request))
}

export function OPTIONS(request: Request): Promise<Response> {
  return handle(request, env(request))
}
