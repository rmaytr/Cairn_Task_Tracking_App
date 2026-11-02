/*
 * Build-time assistant settings. No store imports, so the store's defaults can read them.
 */
export const proxyUrl = ((import.meta.env.VITE_AI_PROXY_URL as string | undefined) ?? '').trim().replace(/\/$/, '')
// https, localhost, or same-origin ("/api" when the app and proxy deploy together, e.g. on Vercel).
export const proxyAvailable = /^(https:\/\/|http:\/\/localhost(:\d+)?(\/|$)|\/[a-z])/.test(proxyUrl)
/** A link-only beta: the shared assistant needs no invite code and is on by default. */
export const openProxy = proxyAvailable && import.meta.env.VITE_AI_OPEN === 'true'
