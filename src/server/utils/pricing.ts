// src/server/utils/pricing.ts
// Logika murni (tanpa database): validasi input dan hitung harga dengan Decimal.js.
// Semua uang adalah integer rupiah. Jangan pernah hitung uang dengan angka float biasa.
import Decimal from 'decimal.js'

export type PricingType = 'per_unit' | 'per_m2'

export interface CatalogEntry {
  name: string
  pricingType: PricingType
  price: number
}

export interface ItemInput {
  name: string
  size: string
  qty: number
  unit: string
  /** Opsional: harga satuan manual (rupiah) yang menimpa katalog */
  unitPrice?: number
}

export interface OrderInput {
  customer: string
  dp: number
  items: ItemInput[]
}

export interface PricedItem {
  name: string
  size: string
  qty: number
  unit: string
  unitPrice: number
  subtotal: number
}

export interface ProductInput {
  name: string
  pricingType: PricingType
  price: number
  defaultUnit: string
  active: boolean
  category?: string
  priceMin?: number | null
  priceMax?: number | null
  note?: string
}

type Checked<T> = { ok: true; value: T } | { ok: false; error: string }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

const round0 = (d: Decimal): number => d.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()

/** Format rupiah untuk pesan error: 1500000 -> "Rp1.500.000" */
export const rupiah = (n: number): string => 'Rp' + new Intl.NumberFormat('id-ID').format(n)

const SIZE_AREA_RE = /^(\d+(?:[.,]\d+)?)x(\d+(?:[.,]\d+)?)(cm|mm|m)?$/i
const FACTOR: Record<string, Decimal> = {
  m: new Decimal(1),
  cm: new Decimal('0.01'),
  mm: new Decimal('0.001'),
}

/** "3x1" -> 3 (m2). Tanpa satuan dianggap meter; "60x90cm" -> 0.54. Selain itu (mis. "A3") -> null. */
export function parseAreaM2(size: string): Decimal | null {
  const m = size.replace(/\s+/g, '').match(SIZE_AREA_RE)
  if (!m?.[1] || !m[2]) return null
  const f = FACTOR[(m[3] ?? 'm').toLowerCase()] ?? FACTOR.m!
  const w = new Decimal(m[1].replace(',', '.')).mul(f)
  const h = new Decimal(m[2].replace(',', '.')).mul(f)
  return w.mul(h)
}

export function priceItem(
  item: ItemInput,
  entry: CatalogEntry | undefined,
): { ok: true; item: PricedItem } | { ok: false; error: string } {
  let unitPrice: number
  if (item.unitPrice !== undefined) {
    unitPrice = round0(new Decimal(item.unitPrice))
  } else if (!entry) {
    return fail(`Harga "${item.name}" belum ada di katalog`)
  } else if (entry.pricingType === 'per_m2') {
    const area = parseAreaM2(item.size)
    if (!area) return fail(`"${item.name}" dihitung per m². Isi ukuran seperti 3x1 (meter)`)
    unitPrice = round0(new Decimal(entry.price).mul(area))
  } else {
    unitPrice = round0(new Decimal(entry.price))
  }
  const subtotal = round0(new Decimal(unitPrice).mul(item.qty))
  return {
    ok: true,
    item: { name: item.name, size: item.size, qty: item.qty, unit: item.unit, unitPrice, subtotal },
  }
}

export function sumRupiah(values: number[]): number {
  return round0(values.reduce((acc, v) => acc.plus(v), new Decimal(0)))
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export function validateOrderInput(body: unknown): Checked<OrderInput> {
  if (!isRecord(body)) return fail('Body tidak valid')

  const customer = typeof body.customer === 'string' ? body.customer.trim() : ''
  if (customer.length > 100) return fail('Nama pemesan terlalu panjang (maksimal 100 karakter)')

  const dpRaw = body.dp === undefined || body.dp === null ? 0 : Number(body.dp)
  if (!Number.isFinite(dpRaw) || dpRaw < 0 || dpRaw > 1e10) return fail('DP tidak valid')

  if (!Array.isArray(body.items) || body.items.length === 0) return fail('Minimal satu item')
  if (body.items.length > 50) return fail('Terlalu banyak item (maksimal 50)')

  const items: ItemInput[] = []
  for (const [i, raw] of body.items.entries()) {
    const n = i + 1
    if (!isRecord(raw)) return fail(`Item ${n} tidak valid`)

    const name = typeof raw.name === 'string' ? raw.name.trim().toLowerCase().replace(/\s+/g, ' ') : ''
    if (!name || name.length > 100) return fail(`Nama item ${n} kosong atau terlalu panjang`)

    const qty = Number(raw.qty)
    if (!Number.isFinite(qty) || qty <= 0 || qty > 100_000) return fail(`Jumlah item ${n} tidak valid`)

    const size = typeof raw.size === 'string' ? raw.size.trim() : ''
    if (size.length > 30) return fail(`Ukuran item ${n} terlalu panjang`)
    const unit = typeof raw.unit === 'string' ? raw.unit.trim().toLowerCase() : ''
    if (unit.length > 20) return fail(`Satuan item ${n} terlalu panjang`)

    const item: ItemInput = { name, size, qty, unit }
    if (raw.unitPrice !== undefined && raw.unitPrice !== null && raw.unitPrice !== '') {
      const up = Number(raw.unitPrice)
      if (!Number.isFinite(up) || up < 0 || up > 1e9) return fail(`Harga item ${n} tidak valid`)
      item.unitPrice = up
    }
    items.push(item)
  }

  return { ok: true, value: { customer, dp: Math.round(dpRaw), items } }
}

export function validateProductInput(body: unknown): Checked<ProductInput> {
  if (!isRecord(body)) return fail('Body tidak valid')

  const name = typeof body.name === 'string' ? body.name.trim().toLowerCase().replace(/\s+/g, ' ') : ''
  if (!name || name.length > 60) return fail('Nama produk kosong atau terlalu panjang')

  const pricingType = body.pricingType === 'per_m2' ? 'per_m2' : body.pricingType === 'per_unit' ? 'per_unit' : null
  if (!pricingType) return fail('pricingType harus "per_unit" atau "per_m2"')

  const price = Number(body.price)
  if (!Number.isFinite(price) || price < 0 || price > 1e9) return fail('Harga tidak valid')

  const defaultUnit = typeof body.defaultUnit === 'string' ? body.defaultUnit.trim().toLowerCase() : ''
  if (defaultUnit.length > 20) return fail('Satuan terlalu panjang')

  const category = typeof body.category === 'string' ? body.category.trim() : undefined
  if (category && category.length > 60) return fail('Kategori terlalu panjang')
  const note = typeof body.note === 'string' ? body.note.trim() : undefined
  if (note && note.length > 300) return fail('Catatan terlalu panjang')
  const readOptionalPrice = (value: unknown): number | null | undefined => {
    if (value === undefined) return undefined
    if (value === null || value === '') return null
    const n = Number(value)
    if (!Number.isFinite(n) || n < 0 || n > 1e9) return null
    return Math.round(n)
  }
  const priceMin = readOptionalPrice(body.priceMin)
  const priceMax = readOptionalPrice(body.priceMax)
  if (priceMin === null && body.priceMin !== null && body.priceMin !== '' && body.priceMin !== undefined)
    return fail('Harga minimum tidak valid')
  if (priceMax === null && body.priceMax !== null && body.priceMax !== '' && body.priceMax !== undefined)
    return fail('Harga maksimum tidak valid')
  if (priceMin !== undefined && priceMax !== undefined && priceMin !== null && priceMax !== null && priceMax < priceMin)
    return fail('Harga maksimum tidak boleh lebih kecil dari harga minimum')

  return {
    ok: true,
    value: {
      name,
      pricingType,
      price: Math.round(price),
      defaultUnit,
      active: body.active !== false,
      ...(category === undefined ? {} : { category }),
      ...(priceMin === undefined ? {} : { priceMin }),
      ...(priceMax === undefined ? {} : { priceMax }),
      ...(note === undefined ? {} : { note }),
    },
  }
}
