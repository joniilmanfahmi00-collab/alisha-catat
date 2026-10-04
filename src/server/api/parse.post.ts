// src/server/api/parse.post.ts  ->  POST /api/parse
// Body: { "text": "Pak Dedi pesen spanduk 3x1 dua lembar, DP 100rb" }
import { defineEventHandler, readBody } from 'solid-vue/server'
import { parseOrder } from '../utils/parse-order'

const MAX_TEXT = 500

export default defineEventHandler(async (event) => {
  const body = await readBody<{ text?: unknown }>(event)
  const text = typeof body?.text === 'string' ? body.text.trim() : ''

  if (!text) {
    event.res.status = 400
    return { ok: false, error: 'Teks pesanan kosong' }
  }
  if (text.length > MAX_TEXT) {
    event.res.status = 400
    return { ok: false, error: `Teks terlalu panjang (maksimal ${MAX_TEXT} karakter)` }
  }

  const result = await parseOrder(text)
  if (!result.ok) event.res.status = 502
  return result
})
