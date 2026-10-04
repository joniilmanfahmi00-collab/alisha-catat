// src/server/api/products/index.get.ts  ->  GET /api/products  (katalog harga)
import { defineEventHandler } from 'solid-vue/server'
import { listProducts } from '../../utils/orders'

export default defineEventHandler((event) => {
  try {
    return { ok: true, products: listProducts() }
  } catch (err) {
    console.error('[products] gagal membaca katalog', err)
    event.res.status = 500
    return { ok: false, error: 'Gagal membaca database' }
  }
})
