import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export async function generateSimplePdf(title: string, lines: string[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  page.drawText(title, { x: 50, y: 780, size: 18, font: boldFont, color: rgb(0, 0, 0) })
  lines.forEach((line, i) => {
    page.drawText(line, { x: 50, y: 740 - i * 20, size: 11, font })
  })

  return pdfDoc.save()
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function buildWhatsAppShareLink(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}
