// src/server/api/reports/summary.get.ts  ->  GET /api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
// Ringkasan per hari + total untuk halaman laporan. Tanpa ?from/?to memakai hari ini (WIB).
import { defineEventHandler, getQuery } from 'solid-vue/server'
import { summarizeOrdersByRange, wibDate } from '../../utils/orders'

export default defineEventHandler((event) => {
  const q = getQuery(event)
  const to = typeof q.to === 'string' && q.to ? q.to : wibDate()
  const from = typeof q.from === 'string' && q.from ? q.from : to
  try {
    const result = summarizeOrdersByRange(from, to)
    if (!result.ok) event.res.status = result.status
    return result
  } catch (err) {
    console.error('[reports] gagal meringkas pesanan', err)
    event.res.status = 500
    return { ok: false, error: 'Gagal membaca database' }
  }
})
