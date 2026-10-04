// src/server/api/orders/index.get.ts  ->  GET /api/orders?date=YYYY-MM-DD
// Tanpa ?date, memakai hari ini (WIB). Mengembalikan ringkasan harian + daftar pesanan.
import { defineEventHandler, getQuery } from 'solid-vue/server'
import { getOrderByNumber, listOrdersByDate, wibDate } from '../../utils/orders'

export default defineEventHandler((event) => {
  const q = getQuery(event)
  const number = typeof q.number === 'string' && q.number ? q.number.trim().toUpperCase() : ''
  if (number) {
    try {
      const order = getOrderByNumber(number)
      if (!order) {
        event.res.status = 404
        return { ok: false, error: 'Pesanan tidak ditemukan' }
      }
      return { ok: true, order }
    } catch (err) {
      console.error('[orders] gagal membaca pesanan', err)
      event.res.status = 500
      return { ok: false, error: 'Gagal membaca database' }
    }
  }
  const date = typeof q.date === 'string' && q.date ? q.date : wibDate()
  try {
    const result = listOrdersByDate(date)
    if (!result.ok) event.res.status = result.status
    return result
  } catch (err) {
    console.error('[orders] gagal membaca pesanan', err)
    event.res.status = 500
    return { ok: false, error: 'Gagal membaca database' }
  }
})
