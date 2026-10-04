// src/server/api/warmup.post.ts  ->  POST /api/warmup
// Panggil sekali saat halaman input dibuka, supaya model sudah siap saat pesanan pertama.
import { defineEventHandler } from 'solid-vue/server'
import { warmUpModel } from '../utils/parse-order'

export default defineEventHandler(async (event) => {
  const result = await warmUpModel()
  if (!result.ok) event.res.status = 502
  return result
})
