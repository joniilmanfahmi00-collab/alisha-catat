<script setup lang="ts">
// src/pages/nota.vue  ->  Tab Nota (/nota)
// Cari nota by nomor -> tampil -> cetak PDF/Excel atau kirim gambar ke WA.
// Bisa dibuka langsung dengan /nota?number=AC-20261003-001.
// Tanpa Octans UI: Tailwind (gaya) + Tabler (ikon). Pesan hasil tampil inline, bukan modal.
import '../styles/global.css'
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBrandWhatsapp,
  IconCircleCheck,
  IconFileSpreadsheet,
  IconInfoCircle,
  IconLoader2,
  IconPrinter,
  IconSearch,
} from '@tabler/icons-vue'
import { longDateTime, rupiah } from '../lib/format'
import {
  buildNotaPdf,
  buildNotaWaMessage,
  downloadBlob,
  downloadNotaExcel,
  drawNotaPng,
  normalizeWaPhone,
  type NotaOrder,
} from '../lib/nota-export'
import { downloadPdf } from '../lib/pdf'

interface DetailResponse {
  ok: boolean
  error?: string
  order?: NotaOrder
}
interface TodayRow {
  id: number
  number: string
  customer: string
  total: number
}
interface TodayResponse {
  ok: boolean
  orders?: TodayRow[]
}
interface Notice {
  tone: 'success' | 'info' | 'error'
  text: string
}

const route = useRoute()

const number = ref('')
const wa = ref('')
const waError = ref('')
const order = ref<NotaOrder | null>(null)
const looking = ref(false)
const lookupError = ref('')
const pdfBusy = ref(false)
const xlsBusy = ref(false)
const waBusy = ref(false)
const notice = ref<Notice | null>(null)
const todayRows = ref<TodayRow[]>([])
const todayLoading = ref(false)

/* ---------- Kelas Tailwind yang dipakai ulang ---------- */
const card =
  'relative overflow-hidden rounded-2xl border border-white/80 bg-white/65 p-5 shadow-2xl shadow-emerald-950/10 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/60 dark:shadow-black/30 sm:p-6'
const fieldCls =
  'mt-1 block w-full rounded-xl border border-emerald-200/80 bg-white/70 px-3.5 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100'
const fieldErrCls =
  'mt-1 block w-full rounded-xl border border-red-400 bg-red-50/80 px-3.5 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-red-500/20 dark:border-red-500 dark:bg-red-950/40 dark:text-slate-100'
const btnBase =
  'inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50'
const btnPrimary = `${btnBase} bg-gradient-to-r from-emerald-600 to-green-700 text-white shadow-lg shadow-emerald-900/15 hover:-translate-y-0.5 hover:from-emerald-500 hover:to-green-600 hover:shadow-emerald-900/25`
const btnOutline = `${btnBase} border border-emerald-200/80 bg-white/70 text-slate-800 shadow-sm backdrop-blur-md hover:border-emerald-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10`
const noticeCls: Record<Notice['tone'], string> = {
  success:
    'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
  info: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200',
  error: 'border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200',
}

/* ---------- Format tampilan ---------- */
const itemName = (it: NotaOrder['items'][number]) => (it.size ? `${it.name} (${it.size})` : it.name)
const itemQty = (it: NotaOrder['items'][number]) => (it.unit ? `${it.qty} ${it.unit}` : String(it.qty))

/* ---------- Aksi ---------- */
async function lookup() {
  const n = number.value.trim().toUpperCase()
  if (!n) {
    lookupError.value = 'Isi nomor nota dulu.'
    return
  }
  looking.value = true
  lookupError.value = ''
  notice.value = null
  waError.value = ''
  order.value = null
  try {
    const res = await fetch(`/api/orders?number=${encodeURIComponent(n)}`)
    const data = (await res.json().catch(() => null)) as DetailResponse | null
    if (!res.ok || !data?.ok || !data.order) throw new Error(data?.error ?? `Gagal membaca nota (HTTP ${res.status})`)
    order.value = data.order
    number.value = data.order.number
  } catch (e) {
    lookupError.value = e instanceof Error ? e.message : 'Gagal membaca nota.'
  } finally {
    looking.value = false
  }
}

async function loadToday() {
  todayLoading.value = true
  try {
    const res = await fetch('/api/orders')
    const data = (await res.json().catch(() => null)) as TodayResponse | null
    if (data?.ok && data.orders) todayRows.value = data.orders
  } catch {
    todayRows.value = []
  } finally {
    todayLoading.value = false
  }
}

function pickToday(n: string) {
  number.value = n
  void lookup()
}

async function printPdf() {
  const o = order.value
  if (!o || pdfBusy.value) return
  pdfBusy.value = true
  notice.value = null
  try {
    const bytes = await buildNotaPdf(o)
    downloadPdf(bytes, `nota-${o.number}.pdf`)
    notice.value = { tone: 'success', text: `nota-${o.number}.pdf terunduh.` }
  } catch (e) {
    notice.value = { tone: 'error', text: e instanceof Error ? e.message : 'Gagal mencetak PDF.' }
  } finally {
    pdfBusy.value = false
  }
}

async function printExcel() {
  const o = order.value
  if (!o || xlsBusy.value) return
  xlsBusy.value = true
  notice.value = null
  try {
    await downloadNotaExcel(o)
    notice.value = { tone: 'success', text: `nota-${o.number}.xlsx terunduh.` }
  } catch (e) {
    notice.value = { tone: 'error', text: e instanceof Error ? e.message : 'Gagal mencetak Excel.' }
  } finally {
    xlsBusy.value = false
  }
}

async function sendWa() {
  const o = order.value
  if (!o || waBusy.value) return
  notice.value = null
  const phone = normalizeWaPhone(wa.value)
  if (!phone) {
    waError.value = 'Isi nomor WA pelanggan, mis. 081234567890.'
    return
  }
  waError.value = ''
  waBusy.value = true
  try {
    const blob = await drawNotaPng(o)
    const file = new File([blob], `nota-${o.number}.png`, { type: 'image/png' })
    const message = buildNotaWaMessage(o)
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: `Nota ${o.number}`, text: message })
      notice.value = { tone: 'success', text: 'Gambar nota dibagikan. Pilih WhatsApp di daftar aplikasi.' }
    } else {
      downloadBlob(blob, `nota-${o.number}.png`)
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener')
      notice.value = {
        tone: 'info',
        text: 'Browser ini tidak bisa berbagi langsung. Gambar tersimpan, lampirkan manual di chat WA yang baru dibuka.',
      }
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return // pengguna membatalkan dialog berbagi
    notice.value = { tone: 'error', text: e instanceof Error ? e.message : 'Gagal mengirim gambar.' }
  } finally {
    waBusy.value = false
  }
}

onMounted(() => {
  const q = route.query.number
  if (typeof q === 'string' && q) {
    number.value = q
    void lookup()
  }
  void loadToday()
})
</script>

<template>
  <div class="relative isolate min-h-dvh overflow-hidden bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-100 text-slate-900 dark:from-[#06130f] dark:via-[#0b1915] dark:to-[#101a14] dark:text-slate-100">
    <div aria-hidden="true" class="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div class="absolute -top-40 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-400/10"></div>
      <div class="absolute -bottom-48 -right-32 size-[30rem] rounded-full bg-lime-400/20 blur-3xl dark:bg-green-500/10"></div>
    </div>
    <div class="relative z-10 mx-auto max-w-2xl space-y-4 px-4 py-6">
      <RouterLink
        to="/"
        class="inline-flex items-center gap-1 rounded text-sm font-semibold text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-emerald-300"
      >
        <IconArrowLeft :size="18" aria-hidden="true" />
        Beranda
      </RouterLink>

      <!-- Cari nota -->
      <section :class="card" aria-labelledby="cari-title">
        <div aria-hidden="true" class="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-emerald-200/50"></div>
        <h2 id="cari-title" class="text-lg font-semibold">Cari nota</h2>
        <form class="mt-3" @submit.prevent="lookup">
          <label class="block text-sm font-medium text-slate-600 dark:text-slate-300">
            Nomor nota
            <input
              v-model="number"
              type="text"
              autocapitalize="characters"
              autocomplete="off"
              placeholder="AC-20261003-001"
              :disabled="looking"
              :aria-invalid="lookupError ? 'true' : undefined"
              aria-describedby="nomor-help"
              :class="lookupError ? fieldErrCls : fieldCls"
            />
          </label>
          <p id="nomor-help" class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Lihat nomornya di Beranda setelah menyimpan, atau pilih dari daftar hari ini.
          </p>
          <button type="submit" :disabled="looking" :class="btnPrimary" class="mt-4 w-full sm:w-auto">
            <IconLoader2 v-if="looking" :size="20" class="animate-spin" aria-hidden="true" />
            <IconSearch v-else :size="20" aria-hidden="true" />
            {{ looking ? 'Mencari…' : 'Cari' }}
          </button>
        </form>

        <div
          v-if="lookupError"
          class="mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm"
          :class="noticeCls.error"
          role="alert"
        >
          <IconAlertTriangle :size="20" class="mt-0.5 shrink-0" aria-hidden="true" />
          <p>{{ lookupError }}</p>
        </div>
      </section>

      <!-- Nota -->
      <section v-if="order" :class="card" aria-labelledby="nota-title">
        <h2 id="nota-title" class="text-xl font-bold">{{ order.number }}</h2>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ longDateTime(order.createdAt) }} • {{ order.customer || 'Tanpa nama' }}
        </p>

        <div class="mt-4 overflow-x-auto">
          <table class="w-full min-w-[26rem] text-sm">
            <caption class="sr-only">
              Rincian barang
            </caption>
            <thead>
              <tr class="border-b border-emerald-100 text-slate-500 dark:border-white/10 dark:text-slate-400">
                <th scope="col" class="py-2 pr-3 text-left font-semibold">Barang</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold">Jml</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold">Harga</th>
                <th scope="col" class="py-2 pl-3 text-right font-semibold">Subtotal</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-emerald-100/70 dark:divide-white/5">
              <tr v-for="(it, i) in order.items" :key="i">
                <td class="py-2.5 pr-3">{{ itemName(it) }}</td>
                <td class="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{{ itemQty(it) }}</td>
                <td class="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{{ rupiah(it.unitPrice) }}</td>
                <td class="whitespace-nowrap py-2.5 pl-3 text-right font-medium tabular-nums">
                  {{ rupiah(it.subtotal) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <dl class="mt-4 space-y-1 border-t border-emerald-100 pt-3 dark:border-white/10">
          <div class="flex justify-between">
            <dt>Total</dt>
            <dd class="font-semibold tabular-nums">{{ rupiah(order.total) }}</dd>
          </div>
          <div class="flex justify-between text-slate-600 dark:text-slate-300">
            <dt>DP/Pembayaran</dt>
            <dd class="tabular-nums">{{ rupiah(order.dp) }}</dd>
          </div>
          <div class="flex justify-between text-lg">
            <dt>Sisa</dt>
            <dd class="font-bold tabular-nums">{{ rupiah(Math.max(0, order.remaining)) }}</dd>
          </div>
        </dl>

        <div class="mt-5 flex justify-center" aria-live="polite">
          <span
            class="inline-block -rotate-6 border-[5px] px-8 py-2 text-4xl font-black tracking-[0.18em] opacity-85"
            :class="
              order.remaining <= 0
                ? 'border-emerald-900 text-emerald-900 dark:border-emerald-400 dark:text-emerald-400'
                : 'border-red-700 text-red-700 dark:border-red-400 dark:text-red-400'
            "
          >
            {{ order.remaining <= 0 ? 'LUNAS' : 'HUTANG' }}
          </span>
        </div>

        <div class="mt-5 border-t border-emerald-100 pt-5 dark:border-white/10">
          <label class="block text-sm font-medium text-slate-600 dark:text-slate-300">
            No. WA pelanggan
            <input
              v-model="wa"
              type="tel"
              inputmode="tel"
              autocomplete="off"
              placeholder="081234567890"
              :aria-invalid="waError ? 'true' : undefined"
              aria-describedby="wa-help"
              :class="waError ? fieldErrCls : fieldCls"
            />
          </label>
          <p id="wa-help" class="mt-2 text-sm" :class="waError ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'">
            {{ waError || 'Dipakai tombol kirim gambar.' }}
          </p>

          <div class="mt-4 grid gap-3 sm:grid-cols-3">
            <button type="button" :disabled="pdfBusy" :class="btnOutline" @click="printPdf">
              <IconLoader2 v-if="pdfBusy" :size="20" class="animate-spin" aria-hidden="true" />
              <IconPrinter v-else :size="20" aria-hidden="true" />
              Cetak PDF
            </button>
            <button type="button" :disabled="xlsBusy" :class="btnOutline" @click="printExcel">
              <IconLoader2 v-if="xlsBusy" :size="20" class="animate-spin" aria-hidden="true" />
              <IconFileSpreadsheet v-else :size="20" aria-hidden="true" />
              Cetak Excel
            </button>
            <button type="button" :disabled="waBusy" :class="btnPrimary" @click="sendWa">
              <IconLoader2 v-if="waBusy" :size="20" class="animate-spin" aria-hidden="true" />
              <IconBrandWhatsapp v-else :size="20" aria-hidden="true" />
              Kirim gambar WA
            </button>
          </div>

          <div
            v-if="notice"
            class="mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm"
            :class="noticeCls[notice.tone]"
            :role="notice.tone === 'error' ? 'alert' : 'status'"
          >
            <IconAlertTriangle v-if="notice.tone === 'error'" :size="20" class="mt-0.5 shrink-0" aria-hidden="true" />
            <IconInfoCircle v-else-if="notice.tone === 'info'" :size="20" class="mt-0.5 shrink-0" aria-hidden="true" />
            <IconCircleCheck v-else :size="20" class="mt-0.5 shrink-0" aria-hidden="true" />
            <p>{{ notice.text }}</p>
          </div>
        </div>
      </section>

      <!-- Hari ini -->
      <section v-if="todayRows.length || todayLoading" :class="card" aria-labelledby="today-title">
        <h2 id="today-title" class="text-lg font-semibold">Hari ini</h2>
        <p v-if="todayLoading && !todayRows.length" class="mt-3 flex items-center gap-2 text-sm text-slate-500" role="status">
          <IconLoader2 :size="18" class="animate-spin" aria-hidden="true" />
          Memuat daftar hari ini…
        </p>
        <ul v-else class="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
          <li v-for="r in todayRows" :key="r.id">
            <button
              type="button"
              :aria-current="order?.number === r.number ? 'true' : undefined"
              class="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-emerald-50/70 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:hover:bg-white/5"
              :class="order?.number === r.number ? 'bg-emerald-100/70 dark:bg-emerald-950/50' : ''"
              @click="pickToday(r.number)"
            >
              <span class="min-w-0">
                <span class="block truncate font-medium">{{ r.number }}</span>
                <span class="block truncate text-sm text-slate-500 dark:text-slate-400">
                  {{ r.customer || 'Tanpa nama' }}
                </span>
              </span>
              <span class="shrink-0 font-semibold tabular-nums">{{ rupiah(r.total) }}</span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>