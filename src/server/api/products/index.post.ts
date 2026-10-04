// src/server/api/products/index.post.ts  ->  POST /api/products  (tambah/ubah harga)
// Body: { name, pricingType, price, defaultUnit?, active?, category?, priceMin?, priceMax?, note? }
import { defineEventHandler, readBody } from 'solid-vue/server'
import { upsertProduct } from '../../utils/orders'
import { validateProductInput } from '../../utils/pricing'

export default defineEventHandler(async (event) => {
  let body: unknown
  try {
    body = await readBody(event)
  } catch {
    event.res.status = 400
    return { ok: false, error: 'Body bukan JSON yang valid' }
  }

  const input = validateProductInput(body)
  if (!input.ok) {
    event.res.status = 400
    return { ok: false, error: input.error }
  }

  try {
    return { ok: true, product: upsertProduct(input.value) }
  } catch (err) {
    console.error('[products] gagal menyimpan produk', err)
    event.res.status = 500
    return { ok: false, error: 'Gagal menyimpan ke database' }
  }
})
