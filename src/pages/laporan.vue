<script setup lang="ts">
// src/pages/laporan.vue  ->  Tab Laporan (/laporan)
// Omzet + penjualan: filter Harian/Mingguan/Bulanan, kalender jangkar,
// grafik Chartist, tabel rincian, cetak Excel/PDF.
// Tanpa Octans UI: Tailwind (gaya) + Tabler (ikon). Pesan hasil tampil inline, bukan modal.
import '../styles/global.css'
import { computed, onMounted, ref, watch } from 'vue'
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCircleCheck,
  IconFileSpreadsheet,
  IconLoader2,
  IconPrinter,
  IconRefresh,
} from '@tabler/icons-vue'
import LineChart from '../components/LineChart.vue'
import MonthCalendar from '../components/MonthCalendar.vue'
import { longDay, monthRangeOf, rupiah, shortDay, todayWIB, weekRangeOf } from '../lib/format'
import { buildReportPdf, downloadReportExcel, type ReportFile } from '../lib/nota-export'
import { downloadPdf } from '../lib/pdf'

type Mode = 'harian' | 'mingguan' | 'bulanan'

interface DaySummary {
  date: string
  count: number
  total: number
  dp: number
}
interface RangeSummary {
  from: string
  to: string
  days: DaySummary[]
  totals: { count: number; total: number; dp: number; remaining: number }
}
interface SummaryResponse {
  ok: boolean
  error?: string
  summary?: RangeSummary
}
interface OrderRow {
  id: number
  number: string
  customer: string
  total: number
  dp: number
}
interface OrdersResponse {
  ok: boolean
  orders?: OrderRow[]
}
interface Notice {
  tone: 'success' | 'error'
  text: string
}

const MODES: { value: Mode; label: string }[] = [
  { value: 'harian', label: 'Harian' },
  { value: 'mingguan', label: 'Mingguan' },
  { value: 'bulanan', label: 'Bulanan' },
]

const today = todayWIB()
const mode = ref<Mode>('mingguan')
const anchor = ref(today)
const summary = ref<RangeSummary | null>(null)
const orders = ref<OrderRow[]>([])
const loading = ref(false)
const loadError = ref('')
const pdfBusy = ref(false)
const xlsBusy = ref(false)
const notice = ref<Notice | null>(null)

const range = computed(() => {
  if (mode.value === 'harian') return { from: anchor.value, to: anchor.value }
  if (mode.value === 'mingguan') return weekRangeOf(anchor.value)
  return monthRangeOf(anchor.value)
})

const periodLabel = computed(() => {
  const r = range.value
  return r.from === r.to ? longDay(r.from) : `${longDay(r.from)} – ${longDay(r.to)}`
})

const title = computed(() =>
  mode.value === 'harian' ? 'Laporan Harian' : mode.value === 'mingguan' ? 'Laporan Mingguan' : 'Laporan Bulanan',
)

// Hanya hasil permintaan TERBARU yang dipakai (kalau Aa ganti periode cepat-cepat,
// jawaban lama yang telat datang tidak menimpa yang baru).
let loadSeq = 0
async function load() {
  const seq = ++loadSeq
  const r = range.value
  const harian = mode.value === 'harian'
  const day = anchor.value
  loading.value = true
  loadError.value = ''
  notice.value = null
  try {
    const res = await fetch(`/api/reports/summary?from=${r.from}&to=${r.to}`)
    const data = (await res.json().catch(() => null)) as SummaryResponse | null
    if (!res.ok || !data?.ok || !data.summary) throw new Error(data?.error ?? `Gagal memuat laporan (HTTP ${res.status})`)
    let rows: OrderRow[] = []
    if (harian) {
      const ro = await fetch(`/api/orders?date=${day}`)
      const dato = (await ro.json().catch(() => null)) as OrdersResponse | null
      rows = dato?.orders ?? []
    }
    if (seq !== loadSeq) return
    summary.value = data.summary
    orders.value = rows
  } catch (e) {
    if (seq !== loadSeq) return
    loadError.value = e instanceof Error ? e.message : 'Gagal memuat laporan.'
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

const markers = computed(() =>
  (summary.value?.days ?? [])
    .filter((d) => d.count > 0)
    .map((d) => ({ date: d.date, tooltip: `${d.count} transaksi — ${rupiah(d.total)}` })),
)

const chartLabels = computed(() =>
  mode.value === 'harian' ? orders.value.map((o) => o.number.slice(-3)) : (summary.value?.days ?? []).map((d) => shortDay(d.date)),
)
const chartSeries = computed(() => [
  mode.value === 'harian' ? orders.value.map((o) => o.total) : (summary.value?.days ?? []).map((d) => d.total),
])
const chartReady = computed(() => (mode.value === 'harian' ? orders.value.length > 0 : summary.value !== null))

const stats = computed(() => {
  const t = summary.value?.totals
  if (!t) return []
  return [
    { label: 'Omzet', value: rupiah(t.total) },
    { label: 'DP masuk', value: rupiah(t.dp) },
    { label: 'Sisa', value: rupiah(t.remaining) },
    { label: 'Transaksi', value: new Intl.NumberFormat('id-ID').format(t.count) },
  ]
})

function reportFile(): ReportFile | null {
  const s = summary.value
  if (!s) return null
  return { title: title.value, period: periodLabel.value, days: s.days, totals: s.totals }
}

function fileStem(): string {
  const r = range.value
  return `laporan-${mode.value}-${r.from}${r.from === r.to ? '' : `_sd_${r.to}`}`
}

async function printPdf() {
  const rep = reportFile()
  if (!rep || pdfBusy.value) return
  pdfBusy.value = true
  notice.value = null
  try {
    const bytes = await buildReportPdf(rep)
    downloadPdf(bytes, `${fileStem()}.pdf`)
    notice.value = { tone: 'success', text: `${fileStem()}.pdf terunduh.` }
  } catch (e) {
    notice.value = { tone: 'error', text: e instanceof Error ? e.message : 'Gagal mencetak PDF.' }
  } finally {
    pdfBusy.value = false
  }
}

async function printExcel() {
  const rep = reportFile()
  if (!rep || xlsBusy.value) return
  xlsBusy.value = true
  notice.value = null
  try {
    await downloadReportExcel(rep, `${fileStem()}.xlsx`)
    notice.value = { tone: 'success', text: `${fileStem()}.xlsx terunduh.` }
  } catch (e) {
    notice.value = { tone: 'error', text: e instanceof Error ? e.message : 'Gagal mencetak Excel.' }
  } finally {
    xlsBusy.value = false
  }
}

watch([mode, anchor], () => void load())
onMounted(() => void load())

/* ---------- Kelas Tailwind yang dipakai ulang ---------- */
const card =
  'relative overflow-hidden rounded-2xl border border-white/80 bg-white/65 p-5 shadow-2xl shadow-emerald-950/10 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/60 dark:shadow-black/30 sm:p-6'
const btnOutline =
  'inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200/80 bg-white/70 px-4 text-base font-semibold text-slate-800 shadow-sm backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10'
const noticeCls: Record<Notice['tone'], string> = {
  success:
    'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
  error: 'border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200',
}
const th = 'px-3 py-2 text-right font-semibold first:pl-0 first:text-left last:pr-0'
const td = 'whitespace-nowrap px-3 py-2.5 text-right tabular-nums first:pl-0 first:text-left last:pr-0'
</script>

<template>
  <div class="relative isolate min-h-dvh overflow-hidden bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-100 text-slate-900 dark:from-[#06130f] dark:via-[#0b1915] dark:to-[#101a14] dark:text-slate-100">
    <div aria-hidden="true" class="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div class="absolute -top-40 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-400/10"></div>
      <div class="absolute -bottom-48 -right-32 size-[30rem] rounded-full bg-lime-400/20 blur-3xl dark:bg-green-500/10"></div>
    </div>
    <!-- Bar muat tipis di atas layar -->
    <div
      v-if="loading"
      class="fixed inset-x-0 top-0 z-50 h-1 animate-pulse bg-gradient-to-r from-emerald-500 to-lime-400"
      role="progressbar"
      aria-label="Memuat laporan"
    ></div>

    <div class="relative z-10 mx-auto max-w-2xl space-y-4 px-4 py-6">
      <RouterLink
        to="/"
        class="inline-flex items-center gap-1 rounded text-sm font-semibold text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-emerald-300"
      >
        <IconArrowLeft :size="18" aria-hidden="true" />
        Beranda
      </RouterLink>

      <!-- Periode -->
      <section :class="card" aria-labelledby="periode-title">
        <div aria-hidden="true" class="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-emerald-200/50"></div>
        <h2 id="periode-title" class="text-lg font-semibold">Periode</h2>

        <fieldset class="mt-3">
          <legend class="sr-only">Rentang</legend>
          <div class="grid grid-cols-3 gap-1 rounded-xl border border-emerald-100/80 bg-emerald-100/50 p-1 dark:border-white/10 dark:bg-black/20">
            <label v-for="m in MODES" :key="m.value" class="block">
              <input v-model="mode" type="radio" name="rentang" :value="m.value" class="peer sr-only" />
              <span
                class="flex h-10 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-slate-600 transition-colors peer-checked:bg-gradient-to-r peer-checked:from-emerald-600 peer-checked:to-green-700 peer-checked:text-white peer-checked:shadow-md peer-focus-visible:outline-2 peer-focus-visible:outline-emerald-600 dark:text-slate-300"
              >
                {{ m.label }}
              </span>
            </label>
          </div>
        </fieldset>

        <div class="mt-4">
          <MonthCalendar
            v-model="anchor"
            :markers="markers"
            :range-from="range.from"
            :range-to="range.to"
            :today="today"
          />
        </div>

        <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">{{ title }} • {{ periodLabel }}</p>

        <div
          v-if="loadError"
          class="mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm"
          :class="noticeCls.error"
          role="alert"
        >
          <IconAlertTriangle :size="20" class="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p>{{ loadError }}</p>
            <button
              type="button"
              class="mt-1 inline-flex items-center gap-1 rounded font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              @click="load"
            >
              <IconRefresh :size="16" aria-hidden="true" />
              Coba lagi
            </button>
          </div>
        </div>
      </section>

      <!-- Ringkasan -->
      <section v-if="summary" :class="card" aria-labelledby="ringkasan-title">
        <h2 id="ringkasan-title" class="text-lg font-semibold">Ringkasan</h2>
        <dl class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div v-for="s in stats" :key="s.label" class="rounded-xl border border-emerald-100/80 bg-emerald-50/60 p-3 dark:border-white/10 dark:bg-white/[0.04]">
            <dt class="text-xs font-medium text-slate-500 dark:text-slate-400">{{ s.label }}</dt>
            <dd class="mt-1 text-base font-bold tabular-nums">{{ s.value }}</dd>
          </div>
        </dl>
      </section>

      <!-- Grafik -->
      <section :class="card" aria-labelledby="grafik-title">
        <h2 id="grafik-title" class="text-lg font-semibold">Grafik penjualan</h2>
        <div class="report-chart mt-3">
          <LineChart v-if="chartReady" :labels="chartLabels" :series="chartSeries" />
          <p v-else class="text-sm text-slate-500 dark:text-slate-400" role="status">
            {{ loading ? 'Memuat…' : 'Belum ada penjualan pada periode ini.' }}
          </p>
        </div>
      </section>

      <!-- Rincian -->
      <section :class="card" aria-labelledby="rincian-title">
        <h2 id="rincian-title" class="text-lg font-semibold">Rincian</h2>

        <div class="mt-3 overflow-x-auto">
          <table v-if="mode === 'harian'" class="w-full min-w-[26rem] text-sm">
            <caption class="sr-only">
              Daftar transaksi
            </caption>
            <thead>
              <tr class="border-b border-emerald-100 text-slate-500 dark:border-white/10 dark:text-slate-400">
                <th scope="col" :class="th">Nomor</th>
                <th scope="col" :class="th">Pemesan</th>
                <th scope="col" :class="th">Total</th>
                <th scope="col" :class="th">DP</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-emerald-100/70 dark:divide-white/5">
              <tr v-for="o in orders" :key="o.id">
                <td :class="td">{{ o.number }}</td>
                <td :class="td">{{ o.customer || '-' }}</td>
                <td :class="td">{{ rupiah(o.total) }}</td>
                <td :class="td">{{ rupiah(o.dp) }}</td>
              </tr>
              <tr v-if="!orders.length">
                <td colspan="4" class="py-6 text-center text-slate-500 dark:text-slate-400">
                  {{ loading ? 'Memuat…' : 'Belum ada transaksi.' }}
                </td>
              </tr>
            </tbody>
          </table>

          <table v-else class="w-full min-w-[26rem] text-sm">
            <caption class="sr-only">
              Rincian per hari
            </caption>
            <thead>
              <tr class="border-b border-emerald-100 text-slate-500 dark:border-white/10 dark:text-slate-400">
                <th scope="col" :class="th">Tanggal</th>
                <th scope="col" :class="th">Trx</th>
                <th scope="col" :class="th">Omzet</th>
                <th scope="col" :class="th">DP</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-emerald-100/70 dark:divide-white/5">
              <tr v-for="d in summary?.days ?? []" :key="d.date" :class="d.count === 0 ? 'text-slate-400 dark:text-slate-600' : ''">
                <td :class="td">{{ longDay(d.date) }}</td>
                <td :class="td">{{ d.count }}</td>
                <td :class="td">{{ rupiah(d.total) }}</td>
                <td :class="td">{{ rupiah(d.dp) }}</td>
              </tr>
              <tr v-if="!(summary?.days ?? []).length">
                <td colspan="4" class="py-6 text-center text-slate-500 dark:text-slate-400">
                  {{ loading ? 'Memuat…' : 'Belum ada transaksi.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" :disabled="!summary || pdfBusy" :class="btnOutline" @click="printPdf">
            <IconLoader2 v-if="pdfBusy" :size="20" class="animate-spin" aria-hidden="true" />
            <IconPrinter v-else :size="20" aria-hidden="true" />
            Cetak PDF
          </button>
          <button type="button" :disabled="!summary || xlsBusy" :class="btnOutline" @click="printExcel">
            <IconLoader2 v-if="xlsBusy" :size="20" class="animate-spin" aria-hidden="true" />
            <IconFileSpreadsheet v-else :size="20" aria-hidden="true" />
            Cetak Excel
          </button>
        </div>

        <div
          v-if="notice"
          class="mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm"
          :class="noticeCls[notice.tone]"
          :role="notice.tone === 'error' ? 'alert' : 'status'"
        >
          <IconAlertTriangle v-if="notice.tone === 'error'" :size="20" class="mt-0.5 shrink-0" aria-hidden="true" />
          <IconCircleCheck v-else :size="20" class="mt-0.5 shrink-0" aria-hidden="true" />
          <p>{{ notice.text }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.report-chart :deep(.ct-series-a .ct-line),
.report-chart :deep(.ct-series-a .ct-point) {
  stroke: #059669;
}

.report-chart :deep(.ct-series-a .ct-area) {
  fill: #10b981;
  fill-opacity: 0.12;
}

.report-chart :deep(.ct-grid) {
  stroke: rgb(16 185 129 / 15%);
}

.report-chart :deep(.ct-label) {
  color: #64748b;
  fill: #64748b;
}

:global(.dark) .report-chart :deep(.ct-grid) {
  stroke: rgb(167 243 208 / 12%);
}

:global(.dark) .report-chart :deep(.ct-label) {
  color: #94a3b8;
  fill: #94a3b8;
}
</style>