// src/lib/format.ts
// Format rupiah + aritmetika tanggal WIB untuk client. Murni, tanpa dependensi server.

const idr = new Intl.NumberFormat('id-ID')

/** 1500000 -> "Rp1.500.000" */
export function rupiah(n: number): string {
  return 'Rp' + idr.format(Math.round(n))
}

/** Hari ini (WIB) format YYYY-MM-DD. */
export function todayWIB(d = new Date()): string {
  return new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

/** Geser tanggal YYYY-MM-DD sejauh n hari (aritmetika UTC, kebal DST). */
export function addDaysISO(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10)
}

/** Senin–Minggu yang memuat tanggal. */
export function weekRangeOf(date: string): { from: string; to: string } {
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=Ahad..6=Sabtu
  const back = (dow + 6) % 7 // hari sejak Senin
  return { from: addDaysISO(date, -back), to: addDaysISO(date, 6 - back) }
}

/** Awal–akhir bulan yang memuat tanggal. */
export function monthRangeOf(date: string): { from: string; to: string } {
  const [y, m] = date.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}` }
}

/** "2026-10-03" -> "3/10" (label grafik). */
export function shortDay(date: string): string {
  const parts = date.split('-').map(Number)
  return `${parts[2]}/${parts[1]}`
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** "2026-10-03" -> "3 Okt 2026". */
export function longDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${d} ${BULAN[m - 1]} ${y}`
}

/** ISO instant -> "3 Okt 2026, 10.47" (WIB). */
export function longDateTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}.${mm}`
}
