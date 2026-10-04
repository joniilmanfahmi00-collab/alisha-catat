// src/lib/nota-export.ts
// Cetak nota/laporan di browser: PDF (pdf-lib), Excel (ExcelJS), PNG (canvas),
// dan pesan WhatsApp. Semua jalan client-side, tanpa request tambahan.
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import ExcelJS from 'exceljs'
import { longDateTime, rupiah } from './format'

export interface NotaItem {
  name: string
  size: string
  qty: number
  unit: string
  unitPrice: number
  subtotal: number
}

export interface NotaOrder {
  number: string
  customer: string
  total: number
  dp: number
  remaining: number
  createdAt: string
  items: NotaItem[]
}

export interface ReportDay {
  date: string
  count: number
  total: number
  dp: number
}

const INK = rgb(0.11, 0.12, 0.14)
const MUTED = rgb(0.36, 0.4, 0.45)
const LINE = rgb(0.83, 0.86, 0.89)
const PAID_GREEN = rgb(0.04, 0.32, 0.2)
const DEBT_RED = rgb(0.65, 0.08, 0.12)
const EXCEL_HEADER_FILL = 'FF1F2937'
const EXCEL_TOTAL_FILL = 'FFF3F4F6'

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function rule(page: PDFPage, y: number, x0 = 50, x1 = 545): void {
  page.drawLine({ start: { x: x0, y }, end: { x: x1, y }, thickness: 1, color: LINE })
}

function right(page: PDFPage, text: string, xRight: number, y: number, size: number, font: PDFFont, color = INK): void {
  page.drawText(text, { x: xRight - font.widthOfTextAtSize(text, size), y, size, font, color })
}

/** Potong teks agar muat di lebar kolom (pdf-lib tidak wrap otomatis). */
function fit(text: string, maxWidth: number, size: number, font: PDFFont): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let out = text
  while (out.length > 4 && font.widthOfTextAtSize(out + '…', size) > maxWidth) out = out.slice(0, -1)
  return out + '…'
}

/** Nota pembelian satu halaman (lanjut ke halaman 2+ kalau item banyak). */
export async function buildNotaPdf(order: NotaOrder): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let page = pdf.addPage([595, 842])
  let y = 792

  page.drawText('ALISHA CETAK', { x: 50, y, size: 20, font: bold, color: INK })
  y -= 20
  page.drawText('Nota pesanan cetak', { x: 50, y, size: 11, font, color: MUTED })
  y -= 34
  page.drawText(`Nomor: ${order.number}`, { x: 50, y, size: 11, font, color: INK })
  y -= 17
  page.drawText(`Tanggal: ${longDateTime(order.createdAt)}`, { x: 50, y, size: 11, font, color: INK })
  y -= 17
  page.drawText(`Pemesan: ${order.customer || '-'}`, { x: 50, y, size: 11, font, color: INK })
  y -= 26

  const head = () => {
    page.drawText('Barang', { x: 50, y, size: 10, font: bold, color: MUTED })
    right(page, 'Jml', 372, y, 10, bold, MUTED)
    right(page, 'Harga', 462, y, 10, bold, MUTED)
    right(page, 'Subtotal', 545, y, 10, bold, MUTED)
    y -= 8
    rule(page, y)
    y -= 20
  }
  head()
  for (const it of order.items) {
    if (y < 170) {
      page = pdf.addPage([595, 842])
      y = 792
      head()
    }
    const desc = it.unit ? `${it.qty} ${it.unit}` : String(it.qty)
    page.drawText(fit(it.name, 260, 11, font), { x: 50, y, size: 11, font, color: INK })
    right(page, desc, 372, y, 11, font)
    right(page, rupiah(it.unitPrice), 462, y, 11, font)
    right(page, rupiah(it.subtotal), 545, y, 11, font)
    y -= 15
    if (it.size) {
      page.drawText(fit(`Ukuran: ${it.size}`, 260, 9, font), { x: 50, y, size: 9, font, color: MUTED })
      y -= 13
    } else {
      y -= 4
    }
    y -= 8
  }
  if (y < 150) {
    page = pdf.addPage([595, 842])
    y = 792
  }
  rule(page, y)
  y -= 24
  page.drawText('Total', { x: 50, y, size: 12, font: bold, color: INK })
  right(page, rupiah(order.total), 545, y, 12, bold)
  y -= 20
  page.drawText('DP/Pembayaran', { x: 50, y, size: 11, font, color: INK })
  right(page, rupiah(order.dp), 545, y, 11, font)
  y -= 20
  page.drawText('Sisa', { x: 50, y, size: 12, font: bold, color: INK })
  right(page, rupiah(Math.max(0, order.remaining)), 545, y, 12, bold)
  y -= 50
  const stamp = order.remaining <= 0 ? 'LUNAS' : 'HUTANG'
  const stampSize = 40
  page.drawText(stamp, {
    x: 312 - bold.widthOfTextAtSize(stamp, stampSize) / 2,
    y,
    size: stampSize,
    font: bold,
    color: order.remaining <= 0 ? PAID_GREEN : DEBT_RED,
    rotate: degrees(-10),
    opacity: 0.8,
  })
  y -= 42
  page.drawText('Terima kasih atas pesanan Anda.', { x: 50, y, size: 10, font, color: MUTED })
  return pdf.save()
}

export interface ReportFile {
  title: string
  period: string
  days: ReportDay[]
  totals: { count: number; total: number; dp: number; remaining: number }
}

/** Laporan omzet satu/lebih halaman: judul, periode, tabel harian, total. */
export async function buildReportPdf(rep: ReportFile): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let page = pdf.addPage([595, 842])
  let y = 792
  page.drawText('ALISHA CETAK', { x: 50, y, size: 20, font: bold, color: INK })
  y -= 20
  page.drawText(`${rep.title} — ${rep.period}`, { x: 50, y, size: 11, font, color: MUTED })
  y -= 30

  const head = () => {
    page.drawText('Tanggal', { x: 50, y, size: 10, font: bold, color: MUTED })
    right(page, 'Trx', 232, y, 10, bold, MUTED)
    right(page, 'Omzet', 372, y, 10, bold, MUTED)
    right(page, 'DP', 462, y, 10, bold, MUTED)
    right(page, 'Sisa', 545, y, 10, bold, MUTED)
    y -= 8
    rule(page, y)
    y -= 20
  }
  head()
  for (const d of rep.days) {
    if (y < 150) {
      page = pdf.addPage([595, 842])
      y = 792
      head()
    }
    page.drawText(d.date, { x: 50, y, size: 11, font, color: INK })
    right(page, String(d.count), 232, y, 11, font)
    right(page, rupiah(d.total), 372, y, 11, font)
    right(page, rupiah(d.dp), 462, y, 11, font)
    right(page, rupiah(d.total - d.dp), 545, y, 11, font)
    y -= 22
  }
  if (y < 130) {
    page = pdf.addPage([595, 842])
    y = 792
  }
  rule(page, y)
  y -= 22
  page.drawText(`Total (${rep.totals.count} transaksi)`, { x: 50, y, size: 11, font: bold, color: INK })
  right(page, rupiah(rep.totals.total), 372, y, 11, bold)
  right(page, rupiah(rep.totals.dp), 462, y, 11, bold)
  right(page, rupiah(rep.totals.remaining), 545, y, 11, bold)
  return pdf.save()
}

function styleHeader(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_HEADER_FILL } }
  })
}

function styleTotal(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.font = { bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_TOTAL_FILL } }
  })
}

async function saveWorkbook(wb: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename,
  )
}

/** Nota sebagai .xlsx: identitas, tabel item, total/DP/sisa. */
export async function downloadNotaExcel(order: NotaOrder): Promise<void> {
  const wb = new ExcelJS.Workbook()
  const s = wb.addWorksheet('Nota')
  // Tanpa `header`: ExcelJS menulis header otomatis di baris 1 kalau diisi,
  // padahal baris judul nota ditulis manual di bawah.
  s.columns = [
    { key: 'name', width: 30 },
    { key: 'size', width: 14 },
    { key: 'qty', width: 10 },
    { key: 'unit', width: 12 },
    { key: 'unitPrice', width: 16 },
    { key: 'subtotal', width: 18 },
  ]
  s.addRow({ name: 'ALISHA CETAK' })
  s.addRow({ name: `Nomor: ${order.number}` })
  s.addRow({ name: `Tanggal: ${longDateTime(order.createdAt)}` })
  s.addRow({ name: `Pemesan: ${order.customer || '-'}` })
  s.addRow({})
  const head = s.addRow({ name: 'Barang', size: 'Ukuran', qty: 'Jumlah', unit: 'Satuan', unitPrice: 'Harga', subtotal: 'Subtotal' })
  styleHeader(head)
  for (const it of order.items) {
    const r = s.addRow({ name: it.name, size: it.size, qty: it.qty, unit: it.unit, unitPrice: it.unitPrice, subtotal: it.subtotal })
    r.getCell('unitPrice').numFmt = '#,##0'
    r.getCell('subtotal').numFmt = '#,##0'
  }
  const total = s.addRow({ name: 'Total', subtotal: order.total })
  styleTotal(total)
  total.getCell('subtotal').numFmt = '#,##0'
  const dp = s.addRow({ name: 'DP', subtotal: order.dp })
  dp.getCell('subtotal').numFmt = '#,##0'
  const sisa = s.addRow({ name: 'Sisa', subtotal: Math.max(0, order.remaining) })
  styleTotal(sisa)
  sisa.getCell('subtotal').numFmt = '#,##0'
  const status = s.addRow({ name: 'Status', subtotal: order.remaining <= 0 ? 'LUNAS' : 'HUTANG' })
  status.font = { bold: true, color: { argb: order.remaining <= 0 ? 'FF075231' : 'FF991B1B' } }
  await saveWorkbook(wb, `nota-${order.number}.xlsx`)
}

/** Laporan omzet sebagai .xlsx: satu baris per hari + total. */
export async function downloadReportExcel(rep: ReportFile, filename: string): Promise<void> {
  const wb = new ExcelJS.Workbook()
  const s = wb.addWorksheet('Laporan')
  // Tanpa `header` (lihat downloadNotaExcel): baris judul ditulis manual.
  s.columns = [
    { key: 'date', width: 14 },
    { key: 'count', width: 12 },
    { key: 'total', width: 18 },
    { key: 'dp', width: 18 },
    { key: 'sisa', width: 18 },
  ]
  s.addRow({ date: 'ALISHA CETAK' })
  s.addRow({ date: `${rep.title} — ${rep.period}` })
  s.addRow({})
  const head = s.addRow({ date: 'Tanggal', count: 'Transaksi', total: 'Omzet', dp: 'DP', sisa: 'Sisa' })
  styleHeader(head)
  for (const d of rep.days) {
    const r = s.addRow({ date: d.date, count: d.count, total: d.total, dp: d.dp, sisa: d.total - d.dp })
    r.getCell('total').numFmt = '#,##0'
    r.getCell('dp').numFmt = '#,##0'
    r.getCell('sisa').numFmt = '#,##0'
  }
  const t = s.addRow({
    date: `Total (${rep.totals.count} transaksi)`,
    total: rep.totals.total,
    dp: rep.totals.dp,
    sisa: rep.totals.remaining,
  })
  styleTotal(t)
  t.getCell('total').numFmt = '#,##0'
  t.getCell('dp').numFmt = '#,##0'
  t.getCell('sisa').numFmt = '#,##0'
  await saveWorkbook(wb, filename)
}

/** Gambar nota (PNG) untuk dikirim ke WA. Digambar manual via canvas, tanpa dependensi. */
export function drawNotaPng(order: NotaOrder): Promise<Blob> {
  const W = 760
  const rowH = 64
  const H = 300 + order.items.length * rowH + 300
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Browser tidak mendukung canvas')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#111418'
  let y = 64
  ctx.font = '700 36px system-ui, sans-serif'
  ctx.fillText('ALISHA CETAK', 40, y)
  y += 34
  ctx.font = '400 22px system-ui, sans-serif'
  ctx.fillStyle = '#5b6672'
  ctx.fillText('Nota pesanan cetak', 40, y)
  y += 46
  ctx.fillStyle = '#111418'
  ctx.fillText(`Nomor: ${order.number}`, 40, y)
  y += 34
  ctx.fillText(`Tanggal: ${longDateTime(order.createdAt)}`, 40, y)
  y += 34
  ctx.fillText(`Pemesan: ${order.customer || '-'}`, 40, y)
  y += 30
  ctx.strokeStyle = '#d3d9e0'
  ctx.lineWidth = 2
  const line = () => {
    ctx.beginPath()
    ctx.moveTo(40, y)
    ctx.lineTo(W - 40, y)
    ctx.stroke()
  }
  line()
  y += 36
  ctx.font = '700 20px system-ui, sans-serif'
  ctx.fillStyle = '#5b6672'
  ctx.fillText('Barang', 40, y)
  ctx.textAlign = 'right'
  ctx.fillText('Subtotal', W - 40, y)
  ctx.textAlign = 'left'
  y += 14
  for (const it of order.items) {
    y += 34
    ctx.font = '400 24px system-ui, sans-serif'
    ctx.fillStyle = '#111418'
    const desc = `${it.name}${it.size ? ` (${it.size})` : ''} — ${it.qty} ${it.unit} x ${rupiah(it.unitPrice)}`
    ctx.fillText(desc.slice(0, 42), 40, y)
    ctx.textAlign = 'right'
    ctx.font = '700 24px system-ui, sans-serif'
    ctx.fillText(rupiah(it.subtotal), W - 40, y)
    ctx.textAlign = 'left'
    ctx.font = '400 24px system-ui, sans-serif'
  }
  y += 24
  line()
  y += 44
  ctx.font = '700 26px system-ui, sans-serif'
  ctx.fillStyle = '#111418'
  ctx.fillText('Total', 40, y)
  ctx.textAlign = 'right'
  ctx.fillText(rupiah(order.total), W - 40, y)
  ctx.textAlign = 'left'
  y += 38
  ctx.font = '400 24px system-ui, sans-serif'
  ctx.fillText('DP', 40, y)
  ctx.textAlign = 'right'
  ctx.fillText(rupiah(order.dp), W - 40, y)
  ctx.textAlign = 'left'
  y += 38
  ctx.font = '700 26px system-ui, sans-serif'
  ctx.fillText('Sisa', 40, y)
  ctx.textAlign = 'right'
  ctx.fillText(rupiah(Math.max(0, order.remaining)), W - 40, y)
  ctx.textAlign = 'left'
  y += 88
  ctx.save()
  ctx.translate(W / 2, y)
  ctx.rotate(-Math.PI / 18)
  ctx.font = '900 58px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.lineWidth = 5
  ctx.strokeStyle = order.remaining <= 0 ? '#075231' : '#991b1b'
  ctx.fillStyle = order.remaining <= 0 ? '#075231' : '#991b1b'
  const stamp = order.remaining <= 0 ? 'LUNAS' : 'HUTANG'
  ctx.strokeText(stamp, 0, 0)
  ctx.fillText(stamp, 0, 0)
  ctx.restore()
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal membuat gambar'))), 'image/png')
  })
}

/** "0812…" / "+62812…" / "62812…" -> "62812…". Null kalau tidak valid. */
export function normalizeWaPhone(input: string): string | null {
  let d = input.replace(/\D/g, '')
  if (d.startsWith('0')) d = '62' + d.slice(1)
  else if (d.startsWith('8')) d = '62' + d
  return /^62\d{7,13}$/.test(d) ? d : null
}

/** Ringkasan nota sebagai teks chat WA (format *tebal*). */
export function buildNotaWaMessage(order: NotaOrder): string {
  const lines = [
    '*ALISHA CETAK*',
    `Nota: ${order.number}`,
    `Tanggal: ${longDateTime(order.createdAt)}`,
    `Pemesan: ${order.customer || '-'}`,
    '------------------------',
    ...order.items.map(
      (it) =>
        `${it.qty}x ${it.name}${it.size ? ` (${it.size})` : ''}${it.unit ? `/${it.unit}` : ''} — ${rupiah(it.subtotal)}`,
    ),
    '------------------------',
    `Total: ${rupiah(order.total)}`,
    `DP: ${rupiah(order.dp)}`,
    `Sisa: ${rupiah(Math.max(0, order.remaining))}`,
    `Status: ${order.remaining <= 0 ? 'LUNAS' : 'HUTANG'}`,
    'Terima kasih atas pesanan Anda.',
  ]
  return lines.join('\n')
}
