// src/server/utils/orders.ts
// Satu-satunya pintu ke tabel orders/order_items/products.
// Endpoint API tidak query database langsung, supaya nomor nota, tanggal WIB,
// dan hitung harga konsisten di satu tempat. Memanggil ensureDb() agar tabel
// dan katalog contoh selalu ada sebelum query pertama.
import { and, desc, eq, gte, like, lt } from 'drizzle-orm'
import { db } from '../db/client'
import { ensureDb } from '../db/bootstrap'
import { orderItems, orders, products, type Product } from '../db/schema'
import {
  priceItem,
  sumRupiah,
  type CatalogEntry,
  type OrderInput,
  type PricedItem,
  type ProductInput,
} from './pricing'

ensureDb()

const WIB_OFFSET_MS = 7 * 3600 * 1000

export interface OrderOut {
  id: number
  number: string
  customer: string
  total: number
  dp: number
  /** Sisa bayar (total - dp). Tidak disimpan, dihitung saat dibaca. */
  remaining: number
  createdAt: string
}

export interface OrderItemOut {
  name: string
  size: string
  qty: number
  unit: string
  unitPrice: number
  subtotal: number
}

export interface OrderDetail extends OrderOut {
  items: OrderItemOut[]
}

export type CreateOrderResult =
  | { ok: true; order: OrderDetail }
  | { ok: false; status: number; error: string; details?: { item: number } }

export type ListOrdersResult =
  | {
      ok: true
      date: string
      summary: { count: number; total: number; dp: number; remaining: number }
      orders: OrderOut[]
    }
  | { ok: false; status: number; error: string }

/** Tanggal kalender WIB (YYYY-MM-DD). */
export function wibDate(d = new Date()): string {
  return new Date(d.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10)
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Batas hari WIB dalam ms-epoch UTC. Null kalau format/tanggal tidak sah. */
function wibDayRange(date: string): { start: number; end: number } | null {
  const m = date.match(DATE_RE)
  if (!m?.[1] || !m[2] || !m[3]) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const start = Date.UTC(y, mo - 1, d) - WIB_OFFSET_MS
  const check = new Date(start + WIB_OFFSET_MS)
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d)
    return null
  return { start, end: start + 24 * 3600 * 1000 }
}

type OrderRow = typeof orders.$inferSelect

function toOrderOut(r: OrderRow): OrderOut {
  return {
    id: r.id,
    number: r.number,
    customer: r.customer,
    total: r.total,
    dp: r.dp,
    remaining: r.total - r.dp,
    createdAt: r.createdAt.toISOString(),
  }
}

export function listProducts(): Product[] {
  return db.select().from(products).orderBy(products.name).all()
}

export function upsertProduct(input: ProductInput): Product {
  const existing = db.select().from(products).where(eq(products.name, input.name)).get()
  const values = {
    name: input.name,
    category: input.category ?? existing?.category ?? '',
    pricingType: input.pricingType,
    price: input.price,
    priceMin: input.priceMin === undefined ? (existing?.priceMin ?? input.price) : input.priceMin,
    priceMax: input.priceMax === undefined ? (existing?.priceMax ?? input.price) : input.priceMax,
    defaultUnit: input.defaultUnit,
    note: input.note ?? existing?.note ?? '',
    active: input.active,
  }
  db.insert(products).values(values).onConflictDoUpdate({ target: products.name, set: values }).run()
  return db.select().from(products).where(eq(products.name, input.name)).get() as Product
}

export function createOrder(input: OrderInput): CreateOrderResult {
  const catalog = new Map<string, CatalogEntry>()
  for (const p of db.select().from(products).where(eq(products.active, true)).all()) {
    catalog.set(p.name, { name: p.name, pricingType: p.pricingType, price: p.price })
  }

  const priced: PricedItem[] = []
  for (const [i, item] of input.items.entries()) {
    const r = priceItem(item, catalog.get(item.name))
    if (!r.ok) return { ok: false, status: 400, error: r.error, details: { item: i + 1 } }
    priced.push(r.item)
  }
  const total = sumRupiah(priced.map((i) => i.subtotal))

  // Nomor nota harian: AC-YYYYMMDD-001, ... (urut per hari WIB, anti-duplikat via transaksi)
  const prefix = `AC-${wibDate().replace(/-/g, '')}`
  const detail = db.transaction((tx) => {
    const rows = tx
      .select({ number: orders.number })
      .from(orders)
      .where(like(orders.number, `${prefix}-%`))
      .all()
    let seq = 0
    for (const r of rows) {
      const n = Number(r.number.slice(prefix.length + 1))
      if (Number.isInteger(n) && n > seq) seq = n
    }
    const number = `${prefix}-${String(seq + 1).padStart(3, '0')}`
    const inserted = tx
      .insert(orders)
      .values({ number, customer: input.customer, total, dp: input.dp, createdAt: new Date() })
      .returning()
      .get()
    tx.insert(orderItems)
      .values(
        priced.map((i) => ({
          orderId: inserted.id,
          name: i.name,
          size: i.size,
          qty: i.qty,
          unit: i.unit,
          unitPrice: i.unitPrice,
          subtotal: i.subtotal,
        })),
      )
      .run()
    return {
      ...toOrderOut(inserted),
      items: priced.map((i) => ({
        name: i.name,
        size: i.size,
        qty: i.qty,
        unit: i.unit,
        unitPrice: i.unitPrice,
        subtotal: i.subtotal,
      })),
    }
  })
  return { ok: true, order: detail }
}

export function listOrdersByDate(date: string): ListOrdersResult {
  const range = wibDayRange(date)
  if (!range) return { ok: false, status: 400, error: 'Format tanggal salah (pakai YYYY-MM-DD)' }
  const rows = db
    .select()
    .from(orders)
    .where(and(gte(orders.createdAt, new Date(range.start)), lt(orders.createdAt, new Date(range.end))))
    .orderBy(desc(orders.id))
    .all()
  const list = rows.map(toOrderOut)
  const total = sumRupiah(list.map((o) => o.total))
  const dp = sumRupiah(list.map((o) => o.dp))
  return {
    ok: true,
    date,
    summary: { count: list.length, total, dp, remaining: total - dp },
    orders: list,
  }
}

function toDetail(row: OrderRow): OrderDetail {
  const items = db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, row.id))
    .orderBy(orderItems.id)
    .all()
  return {
    ...toOrderOut(row),
    items: items.map((i) => ({
      name: i.name,
      size: i.size,
      qty: i.qty,
      unit: i.unit,
      unitPrice: i.unitPrice,
      subtotal: i.subtotal,
    })),
  }
}

/** Detail satu pesanan + itemnya (data untuk nota). Null kalau tidak ada. */
export function getOrder(id: number): OrderDetail | null {
  const row = db.select().from(orders).where(eq(orders.id, id)).get()
  if (!row) return null
  return toDetail(row)
}

/** Cari pesanan by nomor nota (mis. AC-20261003-001). Null kalau tidak ada. */
export function getOrderByNumber(number: string): OrderDetail | null {
  const row = db.select().from(orders).where(eq(orders.number, number)).get()
  if (!row) return null
  return toDetail(row)
}

export interface DaySummary {
  date: string
  count: number
  total: number
  dp: number
}

export interface RangeSummary {
  from: string
  to: string
  days: DaySummary[]
  totals: { count: number; total: number; dp: number; remaining: number }
}

export type SummaryResult =
  | { ok: true; summary: RangeSummary }
  | { ok: false; status: number; error: string }

const MAX_RANGE_DAYS = 62

/** Ringkasan per hari untuk rentang tanggal WIB (inklusif). Dipakai halaman laporan. */
export function summarizeOrdersByRange(from: string, to: string): SummaryResult {
  const rFrom = wibDayRange(from)
  const rTo = wibDayRange(to)
  if (!rFrom || !rTo) return { ok: false, status: 400, error: 'Format tanggal salah (pakai YYYY-MM-DD)' }
  if (rFrom.start > rTo.start)
    return { ok: false, status: 400, error: 'Tanggal awal harus sebelum tanggal akhir' }
  const dayCount = Math.round((rTo.start - rFrom.start) / (24 * 3600 * 1000)) + 1
  if (dayCount > MAX_RANGE_DAYS)
    return { ok: false, status: 400, error: `Rentang maksimal ${MAX_RANGE_DAYS} hari` }

  const rows = db
    .select()
    .from(orders)
    .where(and(gte(orders.createdAt, new Date(rFrom.start)), lt(orders.createdAt, new Date(rTo.end))))
    .all()
  const buckets = new Map<string, { count: number; total: number; dp: number }>()
  for (const r of rows) {
    const day = wibDate(r.createdAt)
    const b = buckets.get(day) ?? { count: 0, total: 0, dp: 0 }
    b.count += 1
    b.total += r.total
    b.dp += r.dp
    buckets.set(day, b)
  }
  // WIB tanpa DST: tiap langkah 24 jam tepat satu hari kalender
  const days: DaySummary[] = []
  for (let t = rFrom.start; t < rTo.end; t += 24 * 3600 * 1000) {
    const date = wibDate(new Date(t))
    const b = buckets.get(date) ?? { count: 0, total: 0, dp: 0 }
    days.push({ date, count: b.count, total: b.total, dp: b.dp })
  }
  const total = sumRupiah(days.map((d) => d.total))
  const dp = sumRupiah(days.map((d) => d.dp))
  const count = days.reduce((acc, d) => acc + d.count, 0)
  return {
    ok: true,
    summary: { from, to, days, totals: { count, total, dp, remaining: total - dp } },
  }
}
