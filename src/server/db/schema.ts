// src/server/db/schema.ts
// Semua uang disimpan sebagai INTEGER rupiah (tanpa desimal). Hitung dengan Decimal.js,
// bulatkan di akhir, baru simpan. Sisa bayar tidak disimpan: total - dp.
import { relations } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/** Katalog harga dari A Asep beserta kategori dan rentang harga untuk form manual. */
export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  category: text('category').notNull().default(''),
  // per_unit: harga x jumlah. per_m2: harga x luas (panjang x lebar dari ukuran) x jumlah
  pricingType: text('pricing_type', { enum: ['per_unit', 'per_m2'] })
    .notNull()
    .default('per_unit'),
  price: integer('price').notNull(),
  priceMin: integer('price_min'),
  priceMax: integer('price_max'),
  defaultUnit: text('default_unit').notNull().default(''),
  note: text('note').notNull().default(''),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
})

/** Harga awal yang dipakai katalog dan form manual; rentang ditampilkan untuk disesuaikan. */
export const PRICE_LIST = [
  { name: 'undangan blangko', category: 'Undangan Cetak', pricingType: 'per_unit', price: 1000, priceMin: 1000, priceMax: 15000, defaultUnit: 'pcs', note: 'Belum termasuk plastik OPP/label.' },
  { name: 'undangan custom', category: 'Undangan Cetak', pricingType: 'per_unit', price: 3000, priceMin: 3000, priceMax: 5000, defaultUnit: 'pcs', note: 'Belum termasuk plastik OPP/label.' },
  { name: 'yasin arab 64 halaman soft cover', category: 'Buku Yasin', pricingType: 'per_unit', price: 8000, priceMin: 8000, priceMax: 8000, defaultUnit: 'buku', note: 'Belum termasuk plastik OPP, tile, dan DI.' },
  { name: 'yasin arab & latin 128 halaman soft cover', category: 'Buku Yasin', pricingType: 'per_unit', price: 10000, priceMin: 10000, priceMax: 10000, defaultUnit: 'buku', note: 'Belum termasuk plastik OPP, tile, dan DI.' },
  { name: 'banner kualitas standar', category: 'Cetak Banner/Spanduk', pricingType: 'per_unit', price: 25000, priceMin: 25000, priceMax: 25000, defaultUnit: 'm', note: 'Belum termasuk jasa desain.' },
  { name: 'banner kualitas standar vivid', category: 'Cetak Banner/Spanduk', pricingType: 'per_unit', price: 30000, priceMin: 30000, priceMax: 30000, defaultUnit: 'm', note: 'Belum termasuk jasa desain.' },
  { name: 'banner kualitas high', category: 'Cetak Banner/Spanduk', pricingType: 'per_unit', price: 35000, priceMin: 35000, priceMax: 35000, defaultUnit: 'm', note: 'Belum termasuk jasa desain.' },
  { name: 'x-banner', category: 'Cetak Banner/Spanduk', pricingType: 'per_unit', price: 100000, priceMin: 100000, priceMax: 100000, defaultUnit: 'pcs', note: 'Belum termasuk jasa desain.' },
  { name: 'print text', category: 'Print Out', pricingType: 'per_unit', price: 1000, priceMin: 1000, priceMax: 1000, defaultUnit: 'lembar', note: 'Free export PDF.' },
  { name: 'print warna', category: 'Print Out', pricingType: 'per_unit', price: 1500, priceMin: 1500, priceMax: 1500, defaultUnit: 'lembar', note: 'Free export PDF.' },
  { name: 'print gambar', category: 'Print Out', pricingType: 'per_unit', price: 1500, priceMin: 1500, priceMax: 3000, defaultUnit: 'lembar', note: 'Tidak termasuk jasa edit; free export PDF.' },
  { name: 'scan berkas', category: 'Scan Berkas', pricingType: 'per_unit', price: 1000, priceMin: 1000, priceMax: 1000, defaultUnit: 'lembar', note: 'Tidak bisa scan F4 yang sudah dilaminating; berkas harus berupa lembaran, bukan buku.' },
  { name: 'sticker kertas', category: 'Sticker', pricingType: 'per_unit', price: 8000, priceMin: 8000, priceMax: 8000, defaultUnit: 'lembar', note: '' },
  { name: 'sticker chromo PO', category: 'Sticker', pricingType: 'per_unit', price: 30000, priceMin: 30000, priceMax: 30000, defaultUnit: 'A3', note: 'Harga bisa nego untuk pembelian minimal.' },
  { name: 'sticker vynil PO', category: 'Sticker', pricingType: 'per_unit', price: 30000, priceMin: 30000, priceMax: 30000, defaultUnit: 'A3', note: 'Harga bisa nego untuk pembelian minimal.' },
  { name: 'sticker graftac PO', category: 'Sticker', pricingType: 'per_unit', price: 180000, priceMin: 180000, priceMax: 180000, defaultUnit: 'm', note: '' },
  { name: 'foto 4R + figura', category: 'Cetak Foto', pricingType: 'per_unit', price: 25000, priceMin: 25000, priceMax: 25000, defaultUnit: 'set', note: 'Belum termasuk jasa foto.' },
  { name: 'foto 5R + figura', category: 'Cetak Foto', pricingType: 'per_unit', price: 30000, priceMin: 30000, priceMax: 30000, defaultUnit: 'set', note: 'Belum termasuk jasa foto.' },
  { name: 'foto 6R + figura', category: 'Cetak Foto', pricingType: 'per_unit', price: 35000, priceMin: 35000, priceMax: 35000, defaultUnit: 'set', note: 'Belum termasuk jasa foto.' },
  { name: 'foto 8R + figura', category: 'Cetak Foto', pricingType: 'per_unit', price: 40000, priceMin: 40000, priceMax: 40000, defaultUnit: 'set', note: 'Belum termasuk jasa foto.' },
  { name: 'foto 10R + figura', category: 'Cetak Foto', pricingType: 'per_unit', price: 50000, priceMin: 50000, priceMax: 50000, defaultUnit: 'set', note: 'Belum termasuk jasa foto.' },
  { name: 'foto 2R', category: 'Cetak Foto', pricingType: 'per_unit', price: 2000, priceMin: 2000, priceMax: 2000, defaultUnit: 'lembar', note: 'Belum termasuk jasa foto.' },
  { name: 'foto 3R', category: 'Cetak Foto', pricingType: 'per_unit', price: 3000, priceMin: 3000, priceMax: 3000, defaultUnit: 'lembar', note: 'Belum termasuk jasa foto.' },
  { name: 'foto 2x3', category: 'Cetak Foto', pricingType: 'per_unit', price: 1000, priceMin: 1000, priceMax: 1000, defaultUnit: 'lembar', note: 'Belum termasuk jasa foto.' },
  { name: 'foto 4x3', category: 'Cetak Foto', pricingType: 'per_unit', price: 1500, priceMin: 1500, priceMax: 1500, defaultUnit: 'lembar', note: 'Belum termasuk jasa foto.' },
  { name: 'foto 4R', category: 'Cetak Foto', pricingType: 'per_unit', price: 4000, priceMin: 4000, priceMax: 4000, defaultUnit: 'lembar', note: 'Belum termasuk jasa foto.' },
  { name: 'foto 4x6', category: 'Cetak Foto', pricingType: 'per_unit', price: 2000, priceMin: 2000, priceMax: 2000, defaultUnit: 'lembar', note: 'Belum termasuk jasa foto.' },
  { name: 'foto 5R', category: 'Cetak Foto', pricingType: 'per_unit', price: 6000, priceMin: 6000, priceMax: 6000, defaultUnit: 'lembar', note: 'Belum termasuk jasa foto.' },
  { name: 'foto 2x3 isi 6 pcs', category: 'Cetak Foto', pricingType: 'per_unit', price: 5000, priceMin: 5000, priceMax: 5000, defaultUnit: 'paket (6 pcs)', note: 'Belum termasuk jasa foto.' },
  { name: 'foto 8R', category: 'Cetak Foto', pricingType: 'per_unit', price: 12500, priceMin: 12500, priceMax: 12500, defaultUnit: 'lembar', note: 'Belum termasuk jasa foto.' },
  { name: 'foto 4x3 isi 4 pcs', category: 'Cetak Foto', pricingType: 'per_unit', price: 5000, priceMin: 5000, priceMax: 5000, defaultUnit: 'paket (4 pcs)', note: 'Belum termasuk jasa foto.' },
  { name: 'foto 10R', category: 'Cetak Foto', pricingType: 'per_unit', price: 15000, priceMin: 15000, priceMax: 15000, defaultUnit: 'lembar', note: 'Belum termasuk jasa foto.' },
  { name: 'foto 4x6 isi 3 pcs', category: 'Cetak Foto', pricingType: 'per_unit', price: 5000, priceMin: 5000, priceMax: 5000, defaultUnit: 'paket (3 pcs)', note: 'Belum termasuk jasa foto.' },
  { name: 'fotocopy hitam putih 1 lembar', category: 'Fotocopy', pricingType: 'per_unit', price: 500, priceMin: 500, priceMax: 500, defaultUnit: 'lembar', note: 'Sudah free plastik.' },
  { name: 'fotocopy hitam putih 3 lembar', category: 'Fotocopy', pricingType: 'per_unit', price: 1000, priceMin: 1000, priceMax: 1000, defaultUnit: 'paket (3 lembar)', note: 'Sudah free plastik.' },
  { name: 'fotocopy di atas Rp5.000', category: 'Fotocopy', pricingType: 'per_unit', price: 5000, priceMin: 5000, priceMax: 5000, defaultUnit: 'paket (250 lembar)', note: 'Harga Rp5.000/250 lembar untuk pembelian di atas Rp5.000; sudah free plastik.' },
  { name: 'fotocopy warna', category: 'Fotocopy', pricingType: 'per_unit', price: 1500, priceMin: 1500, priceMax: 3000, defaultUnit: 'lembar', note: 'Sudah free plastik.' },
  { name: 'stempel flash', category: 'Stempel Flash', pricingType: 'per_unit', price: 75000, priceMin: 75000, priceMax: 120000, defaultUnit: 'pcs', note: 'Belum termasuk jasa desain.' },
  { name: 'set ID card + tali', category: 'ID Card', pricingType: 'per_unit', price: 8000, priceMin: 8000, priceMax: 8000, defaultUnit: 'set', note: 'Belum termasuk jasa desain.' },
  { name: 'set ID card PVC', category: 'ID Card', pricingType: 'per_unit', price: 12500, priceMin: 12500, priceMax: 12500, defaultUnit: 'set', note: 'Belum termasuk jasa desain.' },
  { name: 'ID card laminating + tali', category: 'ID Card', pricingType: 'per_unit', price: 7000, priceMin: 7000, priceMax: 7000, defaultUnit: 'set', note: 'Belum termasuk jasa desain.' },
  { name: 'kartu PVC standar', category: 'Ete Card', pricingType: 'per_unit', price: 10000, priceMin: 10000, priceMax: 10000, defaultUnit: 'pcs', note: 'Belum termasuk jasa desain.' },
  { name: 'kartu PVC premium', category: 'Ete Card', pricingType: 'per_unit', price: 20000, priceMin: 20000, priceMax: 20000, defaultUnit: 'pcs', note: 'Belum termasuk jasa desain.' },
  { name: 'kartu UV', category: 'Ete Card', pricingType: 'per_unit', price: 40000, priceMin: 40000, priceMax: 40000, defaultUnit: 'pcs', note: 'Belum termasuk jasa desain.' },
] satisfies Array<{
  name: string
  category: string
  pricingType: 'per_unit' | 'per_m2'
  price: number
  priceMin: number | null
  priceMax: number | null
  defaultUnit: string
  note: string
}>

export const orders = sqliteTable(
  'orders',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    number: text('number').notNull().unique(), // mis. AC-20261003-001
    customer: text('customer').notNull().default(''),
    total: integer('total').notNull().default(0),
    dp: integer('dp').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('orders_created_at_idx').on(t.createdAt)],
)

export const orderItems = sqliteTable(
  'order_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    size: text('size').notNull().default(''),
    qty: real('qty').notNull(),
    unit: text('unit').notNull().default(''),
    unitPrice: integer('unit_price').notNull().default(0),
    subtotal: integer('subtotal').notNull().default(0),
  },
  (t) => [index('order_items_order_id_idx').on(t.orderId)],
)

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}))

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}))

export type Product = typeof products.$inferSelect
export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type OrderItemRow = typeof orderItems.$inferSelect
export type NewOrderItem = typeof orderItems.$inferInsert
