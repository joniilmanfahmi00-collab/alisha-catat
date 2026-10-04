// src/server/api/orders/index.post.ts  ->  POST /api/orders
// Body: { customer, dp, items: [{ name, size, qty, unit, unitPrice? }] }
import { defineEventHandler, readBody } from 'solid-vue/server'
import { createOrder } from '../../utils/orders'
import { validateOrderInput } from '../../utils/pricing'

export default defineEventHandler(async (event) => {
  let body: unknown
  try {
    body = await readBody(event)
  } catch {
    event.res.status = 400
    return { ok: false, error: 'Body bukan JSON yang valid' }
  }

  const input = validateOrderInput(body)
  if (!input.ok) {
    event.res.status = 400
    return { ok: false, error: input.error }
  }

  try {
    const result = createOrder(input.value)
    if (!result.ok) {
      event.res.status = result.status
      return { ok: false, error: result.error, details: result.details }
    }
    event.res.status = 201
    return { ok: true, number: result.order.number, order: result.order }
  } catch (err) {
    console.error('[orders] gagal menyimpan pesanan', err)
    event.res.status = 500
    return { ok: false, error: 'Gagal menyimpan ke database' }
  }
})
