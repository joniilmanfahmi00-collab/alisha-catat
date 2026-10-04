<script setup lang="ts">
// src/components/MonthCalendar.vue
// Kalender bulanan (minggu mulai Senin) pengganti <Calendar> Octans.
// v-model = tanggal terpilih "YYYY-MM-DD". Semua hitungan tanggal memakai UTC murni,
// jadi tidak terpengaruh zona waktu perangkat. "Hari ini" dikirim dari luar (todayWIB()).
import { computed, nextTick, ref, watch } from 'vue'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-vue'

interface Marker {
  date: string
  tooltip?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    markers?: Marker[]
    /** Rentang yang disorot (mis. minggu/bulan terpilih), format YYYY-MM-DD */
    rangeFrom?: string
    rangeTo?: string
    today?: string
  }>(),
  { markers: () => [], rangeFrom: '', rangeTo: '', today: '' },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const YMD = /^\d{4}-\d{2}-\d{2}$/

const pad = (n: number) => String(n).padStart(2, '0')
const toYmd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1))
}
function addDays(s: string, n: number): string {
  const d = parseYmd(s)
  d.setUTCDate(d.getUTCDate() + n)
  return toYmd(d)
}

const initial = YMD.test(props.modelValue) ? props.modelValue : YMD.test(props.today) ? props.today : toYmd(new Date())
const view = ref(initial.slice(0, 7)) // "YYYY-MM" bulan yang sedang ditampilkan
const focusDate = ref(initial) // sel yang bisa difokus (roving tabindex)
const grid = ref<HTMLElement | null>(null)

watch(
  () => props.modelValue,
  (v) => {
    if (!YMD.test(v)) return
    view.value = v.slice(0, 7)
    focusDate.value = v
  },
)

const monthLabel = computed(() =>
  new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parseYmd(`${view.value}-01`)),
)
const fullDate = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeZone: 'UTC' })

const cells = computed(() => {
  const first = parseYmd(`${view.value}-01`)
  const offset = (first.getUTCDay() + 6) % 7 // Senin = 0
  const start = addDays(toYmd(first), -offset)
  const marks = new Map(props.markers.map((m) => [m.date, m.tooltip ?? '']))
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i)
    const tooltip = marks.get(date)
    return {
      date,
      day: Number(date.slice(8)),
      inMonth: date.startsWith(view.value),
      isToday: date === props.today,
      isSelected: date === props.modelValue,
      inRange: !!props.rangeFrom && !!props.rangeTo && date >= props.rangeFrom && date <= props.rangeTo,
      marked: tooltip !== undefined,
      tooltip: tooltip ?? '',
      label: fullDate.format(parseYmd(date)) + (tooltip ? `, ${tooltip}` : ''),
    }
  })
})
const rows = computed(() => Array.from({ length: 6 }, (_, r) => cells.value.slice(r * 7, r * 7 + 7)))

// Satu sel saja yang bisa di-Tab; panah berpindah di dalam kalender
const tabStop = computed(() =>
  cells.value.some((c) => c.date === focusDate.value) ? focusDate.value : `${view.value}-01`,
)

function shiftMonth(delta: number) {
  const d = parseYmd(`${view.value}-01`)
  d.setUTCMonth(d.getUTCMonth() + delta)
  view.value = toYmd(d).slice(0, 7)
}

function select(date: string) {
  focusDate.value = date
  emit('update:modelValue', date)
}

function goToday() {
  if (YMD.test(props.today)) select(props.today)
}

function onKey(e: KeyboardEvent) {
  const delta = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[e.key]
  if (delta === undefined) return
  e.preventDefault()
  const next = addDays(focusDate.value, delta)
  focusDate.value = next
  view.value = next.slice(0, 7)
  void nextTick(() => grid.value?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus())
}

const navBtn =
  'rounded-lg p-2 text-slate-600 hover:bg-emerald-100/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-600 dark:text-slate-300 dark:hover:bg-white/10'
const dayBase =
  'relative mx-auto flex size-10 items-center justify-center rounded-lg text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-600'

function dayClass(c: (typeof cells.value)[number]): string[] {
  const tone = c.isSelected
    ? 'bg-gradient-to-br from-emerald-600 to-green-700 font-semibold text-white shadow-md shadow-emerald-900/20'
    : c.inRange
      ? 'bg-emerald-100/70 text-slate-900 hover:bg-emerald-200/70 dark:bg-emerald-950/50 dark:text-slate-100 dark:hover:bg-emerald-900/60'
      : c.inMonth
        ? 'text-slate-900 hover:bg-emerald-100/70 dark:text-slate-100 dark:hover:bg-white/10'
        : 'text-slate-400 hover:bg-emerald-100/70 dark:text-slate-600 dark:hover:bg-white/10'
  return [dayBase, tone, c.isToday && !c.isSelected ? 'ring-2 ring-inset ring-emerald-600 dark:ring-emerald-400' : '']
}
</script>

<template>
  <div>
    <div class="mb-2 flex items-center justify-between gap-2">
      <button type="button" :class="navBtn" aria-label="Bulan sebelumnya" @click="shiftMonth(-1)">
        <IconChevronLeft :size="20" aria-hidden="true" />
      </button>
      <div class="flex items-center gap-2">
        <h3 class="text-base font-semibold capitalize" aria-live="polite">{{ monthLabel }}</h3>
        <button
          v-if="today"
          type="button"
          class="rounded-md px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
          @click="goToday"
        >
          Hari ini
        </button>
      </div>
      <button type="button" :class="navBtn" aria-label="Bulan berikutnya" @click="shiftMonth(1)">
        <IconChevronRight :size="20" aria-hidden="true" />
      </button>
    </div>

    <div ref="grid" role="grid" :aria-label="`Kalender ${monthLabel}`" @keydown="onKey">
      <div role="row" class="grid grid-cols-7">
        <span
          v-for="w in WEEKDAYS"
          :key="w"
          role="columnheader"
          class="py-1 text-center text-xs font-medium text-slate-500 dark:text-slate-400"
        >
          {{ w }}
        </span>
      </div>
      <div v-for="(row, r) in rows" :key="r" role="row" class="grid grid-cols-7 gap-y-1">
        <div v-for="c in row" :key="c.date" role="gridcell">
          <button
            type="button"
            :data-date="c.date"
            :class="dayClass(c)"
            :tabindex="c.date === tabStop ? 0 : -1"
            :aria-pressed="c.isSelected"
            :aria-current="c.isToday ? 'date' : undefined"
            :aria-label="c.label"
            :title="c.tooltip || undefined"
            @click="select(c.date)"
          >
            {{ c.day }}
            <span
              v-if="c.marked"
              class="absolute bottom-1 size-1.5 rounded-full"
              :class="c.isSelected ? 'bg-white' : 'bg-emerald-600 dark:bg-emerald-400'"
              aria-hidden="true"
            ></span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>