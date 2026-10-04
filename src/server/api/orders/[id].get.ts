// src/server/api/orders/[id].get.ts  ->  GET /api/orders/:id  (data untuk nota)
import { defineEventHandler, getRouterParam } from 'solid-vue/server'
import { getOrder } from '../../utils/orders'

export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    event.res.status = 400
    return { ok: false, error: 'ID pesanan tidak valid' }
  }
  try {
    const order = getOrder(id)
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
})
