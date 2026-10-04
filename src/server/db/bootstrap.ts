// Membuat tabel (jika belum ada) dan mengisi katalog harga awal.
// DDL harus tetap sama dengan schema.ts. Dipanggil otomatis oleh utils/orders.ts.
import { and, eq, sql } from 'drizzle-orm'
import { db } from './client'
import { PRICE_LIST, products } from './schema'

const DDL = [
  `PRAGMA foreign_keys = ON`,
  `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT '',
    pricing_type TEXT NOT NULL DEFAULT 'per_unit',
    price INTEGER NOT NULL,
    price_min INTEGER,
    price_max INTEGER,
    default_unit TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT NOT NULL UNIQUE,
    customer TEXT NOT NULL DEFAULT '',
    total INTEGER NOT NULL DEFAULT 0,
    dp INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at)`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    size TEXT NOT NULL DEFAULT '',
    qty REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT '',
    unit_price INTEGER NOT NULL DEFAULT 0,
    subtotal INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id)`,
]

const LEGACY_SAMPLE_PRODUCTS = [
  { name: 'spanduk', price: 25000 },
  { name: 'kartu nama', price: 35000 },
  { name: 'stiker', price: 5000 },
  { name: 'undangan', price: 1500 },
  { name: 'foto', price: 3000 },
  { name: 'brosur', price: 1000 },
]

let ready = false

export function ensureDb(): void {
  if (ready) return
  for (const stmt of DDL) db.run(sql.raw(stmt))

  const columns = db.all<{ name: string }>(sql.raw('PRAGMA table_info(products)'))
  const existingColumns = new Set(columns.map((column) => column.name))
  const migrations = [
    ['category', `ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT ''`],
    ['price_min', 'ALTER TABLE products ADD COLUMN price_min INTEGER'],
    ['price_max', 'ALTER TABLE products ADD COLUMN price_max INTEGER'],
    ['note', `ALTER TABLE products ADD COLUMN note TEXT NOT NULL DEFAULT ''`],
  ] as const
  for (const [name, statement] of migrations) {
    if (!existingColumns.has(name)) db.run(sql.raw(statement))
  }

  for (const sample of LEGACY_SAMPLE_PRODUCTS) {
    db.delete(products).where(and(eq(products.name, sample.name), eq(products.price, sample.price))).run()
  }

  for (const product of PRICE_LIST) {
    db.insert(products)
      .values({ ...product, active: true })
      .onConflictDoNothing({ target: products.name })
      .run()
  }
  ready = true
}
