import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import type { ChainageSummary } from '../chainage/summary'
import type { ChainagePoint } from '../chainage/types'
import { formatGeneratedAt } from './format'

export interface ChainagePdfInput {
  projectName: string
  /** Supplied by the caller; this module never reads the clock. */
  generatedAt: Date
  summary: ChainageSummary
  points: ChainagePoint[]
  mapImage?: { dataUrl: string; width: number; height: number } | null
  elevationUsed: boolean
}

const MARGIN = 15
const PAGE_W = 210
const PAGE_H = 297
const CONTENT_W = PAGE_W - 2 * MARGIN
const FOOTER_Y = PAGE_H - 8
const DASH = '—'

const fixed = (n: number, dp: number) => n.toFixed(dp)

function imageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  return /^data:image\/jpe?g/i.test(dataUrl) ? 'JPEG' : 'PNG'
}

export function buildChainagePdf(input: ChainagePdfInput): jsPDF {
  const { projectName, generatedAt, summary, points, mapImage, elevationUsed } = input
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // ---- Page 1 ----
  let y = MARGIN
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  const allTitleLines = doc.splitTextToSize(projectName || 'Chainage report', CONTENT_W) as string[]
  const titleLines = allTitleLines.slice(0, 3)
  if (allTitleLines.length > 3) {
    // Cut to 3 lines: end the last one with an ellipsis (WinAnsi 0x85) that still fits.
    const last = Array.from(titleLines[2].trimEnd())
    while (last.length > 0 && doc.getTextWidth(`${last.join('')}…`) > CONTENT_W) last.pop()
    titleLines[2] = `${last.join('')}…`
  }
  doc.text(titleLines, MARGIN, y + 6)
  y += titleLines.length * 8 + 2

  const generated = formatGeneratedAt(generatedAt)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(90)
  doc.text(`Generated: ${generated}`, MARGIN, y + 2)
  doc.setTextColor(0)
  y += 10

  const coord = (p: { lat: number; lng: number } | null) =>
    p ? `${fixed(p.lat, 6)}, ${fixed(p.lng, 6)}` : DASH
  const total = summary.totalLengthM
  const rows: [string, string][] = [
    ['Total length', `${fixed(total, 2)} m (${fixed(total / 1000, 2)} km)`],
    ['Interval', `${summary.interval} m`],
    ['Start chainage', summary.startLabel || DASH],
    ['End chainage', summary.endLabel || DASH],
    ['Chainage points', String(summary.pointCount)],
    ['Start coordinates', coord(summary.start)],
    ['End coordinates', coord(summary.end)],
  ]
  doc.setFontSize(10)
  for (const [k, v] of rows) {
    doc.setFont('helvetica', 'bold')
    doc.text(`${k}:`, MARGIN, y)
    doc.setFont('helvetica', 'normal')
    doc.text(v, MARGIN + 40, y)
    y += 5.5
  }
  y += 4

  // Reserve room for the attribution line under the image.
  const attributionY = PAGE_H - MARGIN - 6
  const availH = attributionY - 4 - y
  let imageDrawn = false
  if (mapImage && mapImage.width > 0 && mapImage.height > 0 && availH > 0) {
    let w = CONTENT_W
    let h = (w * mapImage.height) / mapImage.width
    if (h > availH) {
      h = availH
      w = (h * mapImage.width) / mapImage.height
    }
    const x = MARGIN + (CONTENT_W - w) / 2
    try {
      doc.addImage(mapImage.dataUrl, imageFormat(mapImage.dataUrl), x, y, w, h)
      doc.setDrawColor(180)
      doc.rect(x, y, w, h)
      imageDrawn = true
    } catch {
      // Corrupt or unsupported image data: fall back to the placeholder below.
    }
  }
  if (!imageDrawn) {
    const h = Math.min(60, Math.max(availH, 0))
    doc.setDrawColor(180)
    doc.setFillColor(244, 244, 244)
    doc.rect(MARGIN, y, CONTENT_W, h, 'FD')
    doc.setTextColor(110)
    doc.setFontSize(11)
    doc.text('Map image unavailable', PAGE_W / 2, y + h / 2, { align: 'center', baseline: 'middle' })
    doc.setTextColor(0)
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(90)
  doc.text(
    `Map data © OpenStreetMap contributors${elevationUsed ? ' · Elevation: Open-Meteo' : ''}`,
    MARGIN,
    attributionY,
  )
  doc.setTextColor(0)

  // ---- Table from page 2 ----
  doc.addPage()
  autoTable(doc, {
    startY: MARGIN,
    margin: { top: MARGIN, left: MARGIN, right: MARGIN, bottom: 18 },
    showHead: 'everyPage',
    head: [
      ['#', 'Chainage', 'Latitude', 'Longitude', 'Distance from previous (m)', 'Bearing (°)', 'Elevation (m)'],
    ],
    body: points.map((p) => [
      String(p.index + 1),
      p.label,
      fixed(p.lat, 6),
      fixed(p.lng, 6),
      fixed(p.distFromPrev, 2),
      p.bearing == null ? DASH : fixed(p.bearing, 1),
      p.elevation == null ? DASH : fixed(p.elevation, 1),
    ]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.6 },
    headStyles: { fillColor: [40, 60, 90], textColor: 255, halign: 'center' },
    columnStyles: {
      0: { halign: 'right', cellWidth: 12 },
      1: { halign: 'left' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
  })

  // ---- Footer on every page ----
  const pages = doc.getNumberOfPages()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(90)
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.text(`Page ${i} of ${pages}`, PAGE_W / 2, FOOTER_Y, { align: 'center' })
  }
  doc.setTextColor(0)

  return doc
}
