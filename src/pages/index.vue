<script setup lang="ts">
// src/pages/index.vue  ->  Beranda (/)
import '../styles/global.css'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconLoader2,
  IconMicrophone,
  IconPlayerStopFilled,
  IconPlus,
  IconReceipt,
  IconTrash,
  IconX,
} from '@tabler/icons-vue'

interface ParsedItem { name: string; size: string; qty: number; unit: string }
interface ParseResponse { ok: boolean; error?: string; order?: { customer: string; items: ParsedItem[]; dp: number; warnings: string[] } }
interface DraftItem { key: number; name: string; size: string; qty: number | null; unit: string; unitPrice: number | null }
interface Draft { customer: string; items: DraftItem[]; dp: number | null; notes: string[] }
interface PriceProduct {
  name: string
  category: string
  price: number
  priceMin: number | null
  priceMax: number | null
  defaultUnit: string
  note: string
  active: boolean
}

const PARSE_TIMEOUT_MS = 200_000
const router = useRouter()

const text = ref('')
const parsing = ref(false)
const elapsed = ref(0)
const parseError = ref('')
const draft = ref<Draft | null>(null)
const saving = ref(false)
const saveError = ref('')
const savedNumber = ref('')
const showSaved = ref(false)
const listening = ref(false)
const micError = ref('')
const catalog = ref<PriceProduct[]>([])
const catalogLoading = ref(false)
const catalogError = ref('')

const draftDialog = ref<HTMLDialogElement | null>(null)
const savedDialog = ref<HTMLDialogElement | null>(null)

const ai = reactive<{ state: 'warming' | 'ready' | 'down' }>({ state: 'warming' })

let uid = 0
let timer: ReturnType<typeof setInterval> | undefined
let rec: SpeechRec | null = null

/* ---------- Mikrofon (Web Speech API) ---------- */
interface SpeechRecResult {
  isFinal: boolean
  [i: number]: { transcript: string }
}
interface SpeechRecEvent {
  resultIndex: number
  results: { length: number; [i: number]: SpeechRecResult }
}
interface SpeechRec {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: SpeechRecEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}
function speechCtor(): (new () => SpeechRec) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec
    webkitSpeechRecognition?: new () => SpeechRec
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}
const voiceSupported = computed(() => speechCtor() !== null)

function stopMic() {
  try {
    rec?.stop()
  } catch {
    /* sudah berhenti */
  }
  rec = null
}

function toggleMic() {
  if (listening.value) {
    stopMic()
    return
  }
  const Ctor = speechCtor()
  if (!Ctor) return
  micError.value = ''
  const base = text.value ? text.value.replace(/\s+$/, '') + ' ' : ''
  let finalText = ''
  try {
    rec = new Ctor()
  } catch {
    micError.value = 'Mikrofon tidak bisa dipakai di browser ini.'
    return
  }
  rec.lang = 'id-ID'
  rec.interimResults = true
  rec.continuous = true
  rec.onresult = (e) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]!
      if (r.isFinal) finalText += r[0]?.transcript ?? ''
      else interim += r[0]?.transcript ?? ''
    }
    text.value = (base + finalText + interim).slice(0, 500)
  }
  rec.onerror = () => {
    micError.value = 'Mikrofon gagal. Cek izin mikrofon browser.'
  }
  rec.onend = () => {
    listening.value = false
    rec = null
  }
  try {
    rec.start()
    listening.value = true
  } catch {
    micError.value = 'Mikrofon gagal dimulai.'
    rec = null
  }
}

/* ---------- Tampilan ---------- */
const aiLabel = computed(() => {
  if (ai.state === 'warming') return 'Menyiapkan AI… (pertama kali bisa 20-40 detik)'
  if (ai.state === 'ready') return 'AI Siap Menerima Pesanan'
  return 'AI sedang offline. Silakan isi manual.'
})
const aiDot = computed(() => {
  if (ai.state === 'ready') return 'bg-emerald-500'
  if (ai.state === 'warming') return 'bg-amber-500 animate-pulse'
  return 'bg-red-500'
})

const issues = computed(() => {
  const d = draft.value
  if (!d) return []
  const out = [...d.notes]
  if (!d.customer.trim()) out.push('Nama pemesan kosong')
  if (!d.dp) out.push('DP Rp0 (Belum ada uang muka)')
  return out
})

// Kelas Tailwind dipakai ulang. Kolom bermasalah memakai set lengkap lain (bukan ditumpuk),
// supaya tidak bergantung pada urutan CSS.
const fieldBase =
  'mt-1 block w-full rounded-xl border px-3.5 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-4 dark:text-slate-100 dark:focus:bg-slate-950'
const fieldOk =
  'border-emerald-200 bg-white/70 focus:border-emerald-600 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-slate-950/50'
const fieldFlag =
  'border-amber-400 bg-amber-50 focus:border-amber-500 focus:ring-amber-500/20 dark:border-amber-500 dark:bg-amber-950/40'
const field = (flag = false) => [fieldBase, flag ? fieldFlag : fieldOk]

const btnBase =
  'inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50'
const btnPrimary = `${btnBase} bg-gradient-to-r from-emerald-600 to-green-700 text-white shadow-lg shadow-emerald-900/15 hover:-translate-y-0.5 hover:from-emerald-500 hover:to-green-600 hover:shadow-emerald-900/25`
const btnOutline = `${btnBase} border border-emerald-200/80 bg-white/70 text-slate-800 shadow-sm backdrop-blur-md hover:border-emerald-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10`
const btnDanger = `${btnBase} bg-red-600 text-white hover:bg-red-700`
const linkBtn =
  'inline-flex items-center gap-1 rounded font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600'

/* ---------- Data ---------- */
function newItem(partial: Partial<DraftItem> = {}): DraftItem {
  return { key: ++uid, name: '', size: '', qty: null, unit: '', unitPrice: null, ...partial }
}

function toDraft(order: NonNullable<ParseResponse['order']>): Draft {
  return {
    customer: order.customer,
    items: order.items.length ? order.items.map((i) => newItem(i)) : [newItem()],
    dp: order.dp || null,
    notes: order.warnings.filter(
      (w) => w.startsWith('Mungkin ada item') || w === 'Tidak ada item terbaca',
    ),
  }
}

function num(v: string | number | null): number | null {
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const inputValue = (e: Event) => (e.target as HTMLInputElement).value
function setQty(it: DraftItem, e: Event) {
  it.qty = num(inputValue(e))
}
function setDp(e: Event) {
  if (draft.value) draft.value.dp = num(inputValue(e))
}
function setUnitPrice(it: DraftItem, e: Event) {
  it.unitPrice = num(inputValue(e))
}
function selectCatalogProduct(it: DraftItem) {
  const name = it.name.trim().toLowerCase().replace(/\s+/g, ' ')
  const product = catalog.value.find((p) => p.name === name && p.active)
  if (!product) {
    it.unitPrice = null
    return
  }
  it.name = product.name
  it.unit = product.defaultUnit
  it.unitPrice = product.price
}
function productForItem(it: DraftItem): PriceProduct | undefined {
  const name = it.name.trim().toLowerCase().replace(/\s+/g, ' ')
  return catalog.value.find((p) => p.name === name && p.active)
}
function formatPrice(price: number): string {
  return `Rp${new Intl.NumberFormat('id-ID').format(price)}`
}
function priceCaption(product: PriceProduct): string {
  const min = product.priceMin ?? product.price
  const max = product.priceMax ?? product.price
  return min === max ? formatPrice(min) : `${formatPrice(min)}–${formatPrice(max)}`
}
function productDetails(it: DraftItem): string {
  const product = productForItem(it)
  return product ? `${product.category} · ${priceCaption(product)}` : ''
}
function productNote(it: DraftItem): string {
  return productForItem(it)?.note ?? ''
}

/* ---------- Dialog bawaan browser ---------- */
function syncDialog(dlg: HTMLDialogElement | null, open: boolean) {
  if (!dlg) return
  if (open && !dlg.open) dlg.showModal()
  else if (!open && dlg.open) dlg.close()
}
watch(draft, async (d) => {
  await nextTick()
  syncDialog(draftDialog.value, d !== null)
})
watch(showSaved, async (v) => {
  await nextTick()
  syncDialog(savedDialog.value, v)
})
// Klik di area gelap (backdrop) menutup dialog
const onBackdrop = (e: MouseEvent, close: () => void) => {
  if (e.target === e.currentTarget) close()
}

/* ---------- Aksi ---------- */
async function warmUp() {
  try {
    const res = await fetch('/api/warmup', { method: 'POST' })
    const data = (await res.json().catch(() => null)) as { ok?: boolean } | null
    ai.state = data?.ok ? 'ready' : 'down'
  } catch {
    ai.state = 'down'
  }
}

function stopTimer() {
  if (timer) clearInterval(timer)
  timer = undefined
}

async function parse() {
  const t = text.value.trim()
  if (!t || parsing.value) return
  stopMic()
  parseError.value = ''
  savedNumber.value = ''
  parsing.value = true
  elapsed.value = 0
  timer = setInterval(() => elapsed.value++, 1000)
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), PARSE_TIMEOUT_MS)
  try {
    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: t }),
      signal: ctrl.signal,
    })
    const data = (await res.json().catch(() => null)) as ParseResponse | null
    if (!data) throw new Error(`Server mengembalikan respons tidak valid (HTTP ${res.status})`)
    if (!data.ok || !data.order) throw new Error(data.error ?? `Gagal membaca pesanan (HTTP ${res.status})`)
    draft.value = toDraft(data.order)
  } catch (e) {
    parseError.value =
      e instanceof Error && e.name === 'AbortError'
        ? 'AI terlalu lama merespons. Coba isi manual.'
        : e instanceof Error
          ? e.message
          : 'Gagal membaca pesanan.'
  } finally {
    clearTimeout(to)
    stopTimer()
    parsing.value = false
  }
}

function startManual() {
  stopMic()
  parseError.value = ''
  savedNumber.value = ''
  saveError.value = ''
  draft.value = { customer: '', items: [newItem()], dp: null, notes: [] }
}

async function loadProducts() {
  catalogLoading.value = true
  catalogError.value = ''
  try {
    const res = await fetch('/api/products')
    const data = (await res.json().catch(() => null)) as { ok?: boolean; products?: PriceProduct[]; error?: string } | null
    if (!res.ok || !data?.ok || !Array.isArray(data.products))
      throw new Error(data?.error ?? `Gagal membaca katalog harga (HTTP ${res.status})`)
    catalog.value = data.products
  } catch (e) {
    catalogError.value = e instanceof Error ? e.message : 'Gagal membaca katalog harga.'
  } finally {
    catalogLoading.value = false
  }
}

function addItem() {
  draft.value?.items.push(newItem())
}

function removeItem(key: number) {
  if (!draft.value || draft.value.items.length <= 1) return
  draft.value.items = draft.value.items.filter((i) => i.key !== key)
}

function cancel() {
  if (saving.value) return
  draft.value = null
  saveError.value = ''
}

async function save() {
  const d = draft.value
  if (!d || saving.value) return
  saveError.value = ''
  const items = d.items
    .filter((i) => i.name.trim() && (i.qty ?? 0) > 0)
    .map((i) => ({
      name: i.name.trim(),
      size: i.size.trim(),
      qty: i.qty as number,
      unit: i.unit.trim(),
      ...(i.unitPrice === null ? {} : { unitPrice: i.unitPrice }),
    }))
  if (!items.length) {
    saveError.value = 'Isi minimal satu item dengan nama dan jumlah.'
    return
  }
  const missingPrice = d.items.find(
    (i) => i.name.trim() && (i.qty ?? 0) > 0 && !productForItem(i) && i.unitPrice === null,
  )
  if (missingPrice) {
    saveError.value = `Isi harga satuan untuk item "${missingPrice.name.trim()}".`
    return
  }
  saving.value = true
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer: d.customer.trim(), items, dp: d.dp ?? 0 }),
    })
    const data = (await res.json().catch(() => null)) as { ok?: boolean; number?: string; error?: string } | null
    if (!res.ok || !data?.ok) throw new Error(data?.error ?? `Gagal menyimpan (HTTP ${res.status})`)
    savedNumber.value = data.number ?? ''
    draft.value = null
    text.value = ''
    showSaved.value = true
  } catch (e) {
    // Kesalahan tampil di dalam dialog (draft tetap terbuka supaya bisa diperbaiki)
    saveError.value = e instanceof Error ? e.message : 'Gagal menyimpan pesanan.'
  } finally {
    saving.value = false
  }
}

function openNota() {
  showSaved.value = false
  if (savedNumber.value) void router.push({ path: '/nota', query: { number: savedNumber.value } })
}

function onInputKey(e: KeyboardEvent) {
  if (e.ctrlKey && e.key === 'Enter') void parse()
}

onMounted(() => {
  void warmUp()
  void loadProducts()
})
onBeforeUnmount(() => {
  stopTimer()
  stopMic()
})
</script>

<template>
  <div class="relative isolate min-h-dvh overflow-hidden bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-100 text-slate-900 dark:from-[#06130f] dark:via-[#0b1915] dark:to-[#101a14] dark:text-slate-100">
    <div aria-hidden="true" class="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div class="absolute -top-40 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-400/10"></div>
      <div class="absolute -bottom-48 -right-32 size-[30rem] rounded-full bg-lime-400/20 blur-3xl dark:bg-green-500/10"></div>
    </div>
    <div class="relative z-10 mx-auto max-w-2xl px-4 py-6">
      <!-- Status AI -->
      <div
        class="mb-6 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/65 px-4 py-2 text-sm font-medium text-slate-700 shadow-lg shadow-emerald-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:shadow-black/20"
        role="status"
        aria-live="polite"
      >
        <span class="size-2.5 rounded-full" :class="aiDot" aria-hidden="true"></span>
        {{ aiLabel }}
      </div>

      <!-- Kartu utama -->
      <section
        class="relative overflow-hidden rounded-2xl border border-white/80 bg-white/65 p-5 shadow-2xl shadow-emerald-950/10 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/60 dark:shadow-black/30 sm:p-6"
        aria-labelledby="input-title"
      >
        <div aria-hidden="true" class="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-emerald-200/50"></div>
        <label id="input-title" for="order-text" class="block text-sm font-semibold">
          Ketik atau Ucapkan Pesanan
        </label>

        <div class="relative mt-2">
          <textarea
            id="order-text"
            v-model="text"
            rows="4"
            maxlength="500"
            :disabled="parsing"
            placeholder="Contoh: Pak Dedi pesan spanduk 3x1 dua lembar, DP 100rb"
            aria-describedby="order-help"
            class="block min-h-32 w-full resize-y rounded-xl border border-emerald-200/80 bg-white/70 p-4 text-[1.05rem] leading-relaxed text-slate-900 transition-colors placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100"
            @keydown="onInputKey"
          ></textarea>

          <!-- Animasi saat mikrofon aktif -->
          <div
            v-if="listening"
            class="absolute inset-1 z-10 flex items-center justify-center gap-3 rounded-xl bg-white/90 font-semibold text-red-600 backdrop-blur-md dark:bg-slate-900/90 dark:text-red-400"
            role="status"
          >
            <span class="relative flex size-3.5" aria-hidden="true">
              <span class="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75"></span>
              <span class="relative inline-flex size-3.5 rounded-full bg-red-500"></span>
            </span>
            Sedang mendengarkan...
          </div>
        </div>

        <div class="mt-2 flex items-start justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
          <p id="order-help">Ketik, bicara lewat mikrofon, lalu tekan Ctrl+Enter.</p>
          <span class="shrink-0 tabular-nums">{{ text.length }}/500</span>
        </div>

        <div class="mt-5 grid gap-3" :class="voiceSupported ? 'sm:grid-cols-[1fr_2fr]' : ''">
          <button
            v-if="voiceSupported"
            type="button"
            :aria-pressed="listening"
            :disabled="parsing"
            :class="listening ? btnDanger : btnOutline"
            class="h-14"
            @click="toggleMic"
          >
            <component :is="listening ? IconPlayerStopFilled : IconMicrophone" :size="22" aria-hidden="true" />
            {{ listening ? 'Berhenti' : 'Bicara' }}
          </button>

          <button type="button" :disabled="parsing || !text.trim()" :class="btnPrimary" class="h-14" @click="parse">
            <IconLoader2 v-if="parsing" :size="22" class="animate-spin" aria-hidden="true" />
            <IconReceipt v-else :size="22" aria-hidden="true" />
            {{ parsing ? 'Memproses...' : 'Catat Pesanan' }}
          </button>
        </div>

        <button
          type="button"
          :disabled="parsing"
          class="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300/80 bg-white/30 font-medium text-emerald-800 transition-colors hover:border-emerald-500 hover:bg-emerald-50/70 hover:text-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:bg-white/[0.03] dark:text-emerald-200 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-100"
          @click="startManual"
        >
          <IconPlus :size="20" aria-hidden="true" />
          Buka Form Manual
        </button>

        <p
          v-if="parsing"
          class="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400"
          role="status"
        >
          <IconLoader2 :size="18" class="animate-spin" aria-hidden="true" />
          Nuju ditarjamahkeun ku AI... {{ elapsed }} detik
        </p>

        <!-- Pesan -->
        <div
          v-if="micError"
          class="mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200"
          role="alert"
        >
          <IconAlertTriangle :size="20" class="mt-0.5 shrink-0" aria-hidden="true" />
          <p>{{ micError }}</p>
        </div>

        <div
          v-if="parseError"
          class="mt-4 flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          <IconAlertTriangle :size="20" class="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p class="font-semibold">Gagal membaca pesanan</p>
            <p>{{ parseError }}</p>
            <button type="button" :class="linkBtn" class="mt-1" @click="startManual">Isi manual</button>
          </div>
        </div>

        <div
          v-if="savedNumber"
          class="mt-4 flex items-start gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
          role="status"
        >
          <IconCircleCheck :size="20" class="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p class="font-semibold">Pesanan tersimpan</p>
            <p>Nomor nota: {{ savedNumber }}</p>
            <button type="button" :class="linkBtn" class="mt-1" @click="openNota">Lihat nota</button>
          </div>
        </div>
      </section>
    </div>

    <!-- Dialog: rincian pesanan (konfirmasi / isi manual) -->
    <dialog
      ref="draftDialog"
      aria-labelledby="draft-title"
      class="m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-lg overflow-hidden rounded-2xl border border-white/80 bg-white/90 p-0 text-slate-900 shadow-2xl shadow-emerald-950/20 backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-100"
      @cancel.prevent="cancel"
      @click="onBackdrop($event, cancel)"
    >
      <div v-if="draft" class="flex max-h-[92dvh] flex-col">
        <header class="flex shrink-0 items-center justify-between border-b border-emerald-100 px-5 py-4 dark:border-white/10">
          <h2 id="draft-title" class="text-lg font-semibold">Rincian Pesanan</h2>
          <button
            type="button"
            aria-label="Tutup"
            :disabled="saving"
            class="rounded-lg p-2 text-slate-500 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10"
            @click="cancel"
          >
            <IconX :size="22" aria-hidden="true" />
          </button>
        </header>

        <div class="space-y-5 overflow-y-auto px-5 py-5">
          <div
            v-if="issues.length"
            class="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <p class="flex items-center gap-2 font-semibold">
              <IconAlertTriangle :size="18" aria-hidden="true" />
              Perlu Pengecekan
            </p>
            <ul class="mt-1 list-disc pl-6">
              <li v-for="w in issues" :key="w">{{ w }}</li>
            </ul>
          </div>

          <label class="block text-sm font-medium text-slate-600 dark:text-slate-300">
            Nama Pelanggan
            <input v-model="draft.customer" :class="field(!draft.customer.trim())" placeholder="Masukkan nama..." />
          </label>

          <p v-if="catalogLoading" class="text-sm text-slate-500 dark:text-slate-400" role="status">
            Memuat daftar harga…
          </p>
          <p v-else-if="catalogError" class="text-sm text-amber-700 dark:text-amber-300" role="alert">
            {{ catalogError }} Isi nama dan harga satuan secara manual.
          </p>

          <datalist id="price-catalog">
            <option
              v-for="product in catalog.filter((p) => p.active)"
              :key="product.name"
              :value="product.name"
              :label="`${product.category} — ${product.name}`"
            ></option>
          </datalist>

          <div class="space-y-4">
            <fieldset
              v-for="(it, i) in draft.items"
              :key="it.key"
              class="rounded-xl border border-emerald-100 bg-white/40 p-4 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <legend class="sr-only">Item {{ i + 1 }}</legend>
              <div class="mb-3 flex items-center justify-between border-b border-dashed border-emerald-100 pb-2 dark:border-white/10">
                <h3 class="text-base font-semibold" aria-hidden="true">Item #{{ i + 1 }}</h3>
                <button
                  v-if="draft.items.length > 1"
                  type="button"
                  :aria-label="`Hapus item ${i + 1}`"
                  class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600 dark:text-red-400 dark:hover:bg-red-950/40"
                  @click="removeItem(it.key)"
                >
                  <IconTrash :size="18" aria-hidden="true" />
                  Hapus
                </button>
              </div>

              <div class="space-y-3">
                <label class="block text-sm font-medium text-slate-600 dark:text-slate-300">
                  Jenis Cetakan
                  <input
                    v-model="it.name"
                    list="price-catalog"
                    :class="field(!it.name.trim())"
                    placeholder="Pilih katalog atau ketik nama sendiri"
                    @change="selectCatalogProduct(it)"
                  />
                  <span v-if="productForItem(it)" class="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
                    {{ productDetails(it) }}
                    <template v-if="productNote(it)"> · {{ productNote(it) }}</template>
                  </span>
                </label>
                <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <label class="block text-sm font-medium text-slate-600 dark:text-slate-300">
                    Ukuran
                    <input v-model="it.size" :class="field()" placeholder="3x1, A3" />
                  </label>
                  <label class="block text-sm font-medium text-slate-600 dark:text-slate-300">
                    Jumlah
                    <input
                      :value="it.qty ?? ''"
                      type="number"
                      inputmode="decimal"
                      min="0"
                      :class="field(!((it.qty ?? 0) > 0))"
                      @input="setQty(it, $event)"
                    />
                  </label>
                  <label class="col-span-2 block text-sm font-medium text-slate-600 dark:text-slate-300 sm:col-span-1">
                    Satuan
                    <input v-model="it.unit" :class="field()" placeholder="Pcs, Lembar" />
                  </label>
                </div>
                <label class="block text-sm font-medium text-slate-600 dark:text-slate-300">
                  Harga Satuan (Rp)
                  <input
                    :value="it.unitPrice ?? ''"
                    type="number"
                    inputmode="numeric"
                    min="0"
                    :class="field(!productForItem(it) && it.unitPrice === null)"
                    placeholder="Masukkan harga satuan"
                    @input="setUnitPrice(it, $event)"
                  />
                  <span class="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
                    Bisa diubah sesuai harga akhir. Harga rentang otomatis terisi dari harga terendah.
                  </span>
                </label>
              </div>
            </fieldset>
          </div>

          <button type="button" :class="btnOutline" class="w-full" @click="addItem">
            <IconPlus :size="20" aria-hidden="true" />
            Tambah Item Lain
          </button>

          <div class="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <label class="block text-sm font-medium text-slate-600 dark:text-slate-300">
              Pembayaran / DP (Rp)
              <input
                :value="draft.dp ?? ''"
                type="number"
                inputmode="numeric"
                min="0"
                placeholder="0"
                :class="field(!draft.dp)"
                @input="setDp"
              />
              <span class="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
                Isi jumlah yang sudah dibayar. Isi sebesar total pesanan untuk menandai lunas.
              </span>
            </label>
          </div>

          <div
            v-if="saveError"
            class="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            <IconAlertTriangle :size="20" class="mt-0.5 shrink-0" aria-hidden="true" />
            <p>{{ saveError }}</p>
          </div>
        </div>

        <footer class="grid shrink-0 grid-cols-2 gap-3 border-t border-emerald-100 px-5 py-4 dark:border-white/10">
          <button type="button" :disabled="saving" :class="btnOutline" @click="cancel">Batal</button>
          <button type="button" :disabled="saving" :class="btnPrimary" @click="save">
            <IconLoader2 v-if="saving" :size="20" class="animate-spin" aria-hidden="true" />
            {{ saving ? 'Menyimpan…' : 'Simpan Pesanan' }}
          </button>
        </footer>
      </div>
    </dialog>

    <!-- Dialog: pesanan tersimpan -->
    <dialog
      ref="savedDialog"
      aria-labelledby="saved-title"
      class="m-auto w-[calc(100%-1.5rem)] max-w-sm rounded-2xl border border-white/80 bg-white/90 p-0 text-slate-900 shadow-2xl shadow-emerald-950/20 backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-100"
      @cancel.prevent="showSaved = false"
      @click="onBackdrop($event, () => (showSaved = false))"
    >
      <div v-if="showSaved" class="p-6 text-center">
        <IconCircleCheck :size="48" class="mx-auto text-emerald-500" aria-hidden="true" />
        <h2 id="saved-title" class="mt-3 text-lg font-semibold">Pesanan Tersimpan</h2>
        <p class="mt-1 text-slate-600 dark:text-slate-300">Nomor nota: {{ savedNumber }}</p>
        <div class="mt-5 grid grid-cols-2 gap-3">
          <button type="button" :class="btnOutline" @click="showSaved = false">Tutup</button>
          <button type="button" :class="btnPrimary" @click="openNota">Lihat Nota</button>
        </div>
      </div>
    </dialog>
  </div>
</template>