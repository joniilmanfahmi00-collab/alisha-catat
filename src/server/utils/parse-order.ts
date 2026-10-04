// src/server/utils/parse-order.ts
// Gemma (via Ollama) hanya mengekstrak teks -> JSON.
// Harga, DP, dan pembersihan data diurus kode, karena model kecil kurang bisa dipercaya
// untuk angka. Hasil tes di PC lawas: gemma3:4b + prompt pendek = 5/5 lulus, ~23 detik.

export interface OrderItem {
  name: string
  size: string
  qty: number
  unit: string
}

export interface ParsedOrder {
  customer: string
  items: OrderItem[]
  dp: number
  /** Dipakai kartu konfirmasi untuk menyorot bagian yang perlu dicek A Asep */
  warnings: string[]
}

export interface ParseStats {
  seconds: number
  tokPerSec: number
  promptTokens: number
  promptSecs: number
  outTokens: number
  loadSecs: number
}

export type ParseResult =
  | { ok: true; order: ParsedOrder; stats: ParseStats }
  | { ok: false; error: string; stats: ParseStats }

const MODEL = process.env.OLLAMA_MODEL ?? 'gemma3:4b'
const OLLAMA = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const TIMEOUT_MS = 180_000

const SCHEMA = {
  type: 'object',
  properties: {
    customer: { type: 'string' },
    payment: { type: 'number' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          size: { type: 'string' },
          qty: { type: 'number' },
          unit: { type: 'string' },
        },
        required: ['name', 'size', 'qty', 'unit'],
      },
    },
  },
  required: ['customer', 'payment', 'items'],
}

// Prompt pendek: di PC lawas, membaca prompt (~10 token/detik) lebih lama daripada
// menulis jawaban. Regex tetap menjadi sumber utama untuk pembayaran jika tertulis.
const SYSTEM = `Ubah pesanan percetakan menjadi JSON. Jangan hitung harga.
customer: nama pemesan ("" jika tidak ada). payment: jumlah DP/pembayaran yang disebutkan dalam rupiah (angka bulat, 0 jika tidak disebutkan). items: name (jenis cetakan tanpa ukuran), size (ukuran), qty (angka), unit (satuan). Isi "" jika tidak ada.
Contoh: "Pak Eko bayar 50000, brosur 200 lembar A5" -> {"customer":"Pak Eko","payment":50000,"items":[{"name":"brosur","size":"A5","qty":200,"unit":"lembar"}]}`

// Katalog contoh. Ganti dengan daftar produk asli dari A Asep.
const CATALOG: Record<string, string[]> = {
  spanduk: ['spanduk', 'banner', 'baliho'],
  'kartu nama': ['kartu nama'],
  stiker: ['stiker', 'sticker'],
  undangan: ['undangan'],
  foto: ['foto'],
}
const UNITS = new Set(['lembar', 'box', 'pcs', 'meter', 'rim', 'buah', 'pack'])
const NUM_WORDS = new Set(['satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh'])
const SIZE_RE = /\b(\d+(?:[.,]\d+)?\s?[x×]\s?\d+(?:[.,]\d+)?|a\d|\d{1,2}\s?r)\b/i
// Ukuran yang dianggap sah. Tambahkan pola lain jika A Asep mencetak ukuran lain.
const VALID_SIZE_RE = /^(\d+(?:[.,]\d+)?x\d+(?:[.,]\d+)?(?:cm|mm|m)?|[ab]\d\+?|\d{1,2}r|f4)$/i
const HONORIFICS = new Set(['pak', 'bapak', 'bu', 'ibu', 'haji', 'hj', 'kang', 'teh', 'mas', 'mbak', 'aa', 'neng'])
const SIZE_AFTER_RE = new RegExp('^\\s*' + SIZE_RE.source, 'i')

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function fmtSize(s: string): string {
  const t = s.replace(/\s+/g, '').replace('×', 'x')
  return /^a\d$/i.test(t) || /^\d{1,2}r$/i.test(t) ? t.toUpperCase() : t.toLowerCase()
}

function normalizeItem(raw: Record<string, unknown>): OrderItem {
  let name = String(raw.name ?? '').trim().toLowerCase()
  let size = String(raw.size ?? '').trim()
  let unit = String(raw.unit ?? '').trim().toLowerCase()

  // model kadang menaruh satuan ("box") di kolom ukuran
  if (UNITS.has(size.toLowerCase())) {
    if (!unit) unit = size.toLowerCase()
    size = ''
  }

  // buang ukuran yang ikut tertulis di nama, atau ambil ukuran dari nama
  if (size) {
    name = name.replace(new RegExp(escapeRe(size), 'i'), ' ')
  } else {
    const m = name.match(SIZE_RE)
    if (m) {
      size = m[0]
      name = name.replace(m[0], ' ')
    }
  }

  name = name.replace(/\bcetak\b/g, ' ').replace(/\s+/g, ' ').trim()

  for (const [key, aliases] of Object.entries(CATALOG)) {
    if (aliases.some((a) => name === a || name.includes(a))) {
      name = key
      break
    }
  }

  // model kadang menaruh jumlah ("satu") di kolom satuan
  if (NUM_WORDS.has(unit)) unit = ''

  // buang "ukuran" ngawur dari model kecil (mis. "100pcs")
  size = fmtSize(size)
  if (size && !VALID_SIZE_RE.test(size)) size = ''

  return { name, size, qty: Number(raw.qty) || 0, unit }
}

// Jika model menghilangkan ukuran, cari ukuran yang tertulis tepat setelah
// nama item di teks asli (mis. "banner 2x1" -> 2x1).
function recoverSize(item: OrderItem, text: string): OrderItem {
  if (item.size) return item
  const lower = text.toLowerCase()
  const aliases = CATALOG[item.name] ?? [item.name]
  for (const a of aliases) {
    const i = lower.indexOf(a)
    if (i < 0) continue
    const m = lower.slice(i + a.length).match(SIZE_AFTER_RE)
    if (m?.[1]) return { ...item, size: fmtSize(m[1]) }
  }
  return item
}

/**
 * "DP 100rb" | "DP 50 ribu" | "uang muka 1.500.000" | "DP 1,5 juta" -> rupiah (integer).
 * Titik dianggap pemisah ribuan (format Indonesia).
 */
function parsePayment(text: string): number | null {
  const m = text.match(
    /\b(?:uang muka|pembayaran|dibayar|bayar|panjar|dp|lunas)\s*(?:rp\.?)?\s*(\d[\d.,]*)\s*(rb|ribu|k|jt|juta)?(?![a-z])/i,
  )
  if (!m?.[1]) return null
  const n = parseFloat(m[1].replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(n)) return null
  const mult: Record<string, number> = { rb: 1e3, ribu: 1e3, k: 1e3, jt: 1e6, juta: 1e6 }
  return Math.round(n * (mult[(m[2] ?? '').toLowerCase()] ?? 1))
}

export function parseDp(text: string): number {
  return parsePayment(text) ?? 0
}

export function postProcess(raw: { customer?: unknown; payment?: unknown; items?: unknown }, text: string): ParsedOrder {
  const rawItems = Array.isArray(raw.items) ? (raw.items as Record<string, unknown>[]) : []
  const items = rawItems
    .map(normalizeItem)
    .filter((i) => i.name && i.qty > 0)
    .map((i) => recoverSize(i, text))
  const lower = text.toLowerCase()

  // nama pemesan harus benar-benar ada di teks (model kecil kadang mengarang, mis. "Pengguna")
  let customer = String(raw.customer ?? '').replace(/^atas nama\s+/i, '').trim()
  const words = customer.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !HONORIFICS.has(w))
  if (!words.some((w) => lower.includes(w))) customer = ''

  const extractedPayment = parsePayment(text)
  const modelPayment = Number(raw.payment)
  const dp =
    extractedPayment ??
    (Number.isFinite(modelPayment) && modelPayment >= 0 && modelPayment <= 1e10 ? Math.round(modelPayment) : 0)

  const warnings: string[] = []
  if (!customer) warnings.push('Nama pemesan kosong')
  if (!items.length) warnings.push('Tidak ada item terbaca')
  if (!dp) warnings.push('Pembayaran Rp0')
  for (const [key, aliases] of Object.entries(CATALOG)) {
    if (aliases.some((a) => lower.includes(a)) && !items.some((i) => i.name === key))
      warnings.push(`Mungkin ada item terlewat: ${key}`)
  }

  return { customer, items, dp, warnings }
}

const emptyStats = (seconds: number): ParseStats => ({
  seconds,
  tokPerSec: 0,
  promptTokens: 0,
  promptSecs: 0,
  outTokens: 0,
  loadSecs: 0,
})

interface OllamaChatResponse {
  message: { content: string }
  eval_count?: number
  eval_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  load_duration?: number
}

export async function parseOrder(text: string): Promise<ParseResult> {
  const t0 = performance.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${OLLAMA}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        format: SCHEMA,
        keep_alive: '30m',
        options: { temperature: 0, num_ctx: 2048, num_predict: 400 },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: text },
        ],
      }),
    })
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`)
    const data = (await res.json()) as OllamaChatResponse
    const raw = JSON.parse(data.message.content) as { customer?: unknown; payment?: unknown; items?: unknown }
    return {
      ok: true,
      order: postProcess(raw, text),
      stats: {
        seconds: (performance.now() - t0) / 1000,
        tokPerSec: data.eval_duration ? (data.eval_count ?? 0) / (data.eval_duration / 1e9) : 0,
        promptTokens: data.prompt_eval_count ?? 0,
        promptSecs: (data.prompt_eval_duration ?? 0) / 1e9,
        outTokens: data.eval_count ?? 0,
        loadSecs: (data.load_duration ?? 0) / 1e9,
      },
    }
  } catch (err) {
    const error =
      err instanceof Error && err.name === 'AbortError'
        ? 'Model terlalu lama merespons'
        : err instanceof Error
          ? err.message
          : String(err)
    return { ok: false, error, stats: emptyStats((performance.now() - t0) / 1000) }
  } finally {
    clearTimeout(timer)
  }
}

/** Memuat model ke memori lebih dulu, supaya pesanan pertama tidak menunggu 20-40 detik. */
export async function warmUpModel(): Promise<{ ok: boolean; seconds: number; error?: string }> {
  const t0 = performance.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${OLLAMA}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({ model: MODEL, keep_alive: '30m' }),
    })
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`)
    return { ok: true, seconds: (performance.now() - t0) / 1000 }
  } catch (err) {
    return {
      ok: false,
      seconds: (performance.now() - t0) / 1000,
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    clearTimeout(timer)
  }
}
