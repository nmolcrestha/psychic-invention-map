import { describe, expect, it } from 'vitest'
import { generateChainage } from '../chainage/generate'
import { EARTH_RADIUS_M } from '../chainage/geo'
import { buildSummary } from '../chainage/summary'
import type { ChainagePoint, LatLng } from '../chainage/types'
import { buildChainagePdf } from './buildReport'

const M_PER_DEG = (EARTH_RADIUS_M * Math.PI) / 180
const east = (metres: number): LatLng => ({ lat: 0, lng: 85.3 + metres / M_PER_DEG })

function make(lengthM: number, interval: number, opts: { elevation?: number | null } = {}) {
  const vertices = [east(0), east(lengthM)]
  const { points } = generateChainage(vertices, interval, 0)
  const withElev: ChainagePoint[] =
    opts.elevation === undefined ? points : points.map((p) => ({ ...p, elevation: opts.elevation }))
  return { vertices, points: withElev, interval }
}

function build(
  overrides: Partial<Parameters<typeof buildChainagePdf>[0]> = {},
  data = make(1500, 10),
) {
  return buildChainagePdf({
    projectName: 'My Road',
    generatedAt: new Date(2026, 10, 12, 14, 30),
    summary: buildSummary(data.points, data.vertices, data.interval),
    points: data.points,
    mapImage: null,
    elevationUsed: false,
    ...overrides,
  })
}

/** Raw PDF content; text is uncompressed, so strings appear as `(text) Tj`. */
const raw = (doc: ReturnType<typeof build>) => doc.output()

describe('buildChainagePdf', () => {
  it('is A4 portrait in mm', () => {
    const doc = build()
    const size = doc.internal.pageSize
    expect(size.getWidth()).toBeCloseTo(210, 1)
    expect(size.getHeight()).toBeCloseTo(297, 1)
  })

  it('300 points give at least 3 pages and footers match the page count', () => {
    const data = make(2990, 10)
    expect(data.points).toHaveLength(300)
    const doc = build({}, data)
    const n = doc.getNumberOfPages()
    expect(n).toBeGreaterThanOrEqual(3)
    const text = raw(doc)
    expect(text).toContain(`(Page 1 of ${n})`)
    expect(text).toContain(`(Page ${n} of ${n})`)
    expect(text.match(/\(Page \d+ of \d+\)/g)).toHaveLength(n)
    expect(text.match(/\(Page \d+ of (\d+)\)/g)!.every((m) => m.endsWith(`of ${n})`))).toBe(true)
  })

  it('shows the title, generated line and summary on page 1', () => {
    const text = raw(build())
    expect(text).toContain('(My Road)')
    expect(text).toMatch(/\(Generated: 2026-11-12 14:30 \\\(UTC[+-]\d\d:\d\d\\\)\)/)
    expect(text).toContain('Total length')
    expect(text).toContain('Chainage points')
  })

  it('shows "Map image unavailable" with no image, and not with one', () => {
    expect(raw(build({ mapImage: null }))).toContain('Map image unavailable')
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const doc = build({ mapImage: { dataUrl: png, width: 1, height: 1 } })
    expect(raw(doc)).not.toContain('Map image unavailable')
  })

  it('falls back to the placeholder for a corrupt image', () => {
    const doc = build(
      { mapImage: { dataUrl: 'data:image/png;base64,AAAA', width: 100, height: 100 } },
      make(100, 50),
    )
    expect(doc.getNumberOfPages()).toBe(2)
    expect(raw(doc)).toContain('Map image unavailable')
  })

  it('starts the table on page 2', () => {
    const doc = build({}, make(100, 50))
    expect(doc.getNumberOfPages()).toBe(2)
    const text = raw(doc)
    expect(text).toContain('(Page 2 of 2)')
    // Header text appears once, and after the page-1 attribution line.
    expect(text.indexOf('OpenStreetMap')).toBeLessThan(text.indexOf('Distance from previous'))
    expect(text.match(/Distance from previous/g)).toHaveLength(1)
  })

  it('ends a title cut to 3 lines with an ellipsis', () => {
    const doc = build({ projectName: 'word '.repeat(200) })
    // WinAnsi ellipsis is byte 0x85.
    expect(raw(doc)).toMatch(/\(word[^)]*\u0085\)/)
  })

  it('renders an em dash for null or missing elevation', () => {
    // WinAnsi em dash is byte 0x97; jsPDF writes it raw into the content stream.
    const dash = '\u0097'
    const none = raw(build({}, make(100, 50)))
    expect(none).toContain(`(${dash})`)
    const nul = raw(build({}, make(100, 50, { elevation: null })))
    expect(nul).toContain(`(${dash})`)
    const withElev = raw(build({}, make(100, 50, { elevation: 12.34 })))
    expect(withElev).toContain('(12.3)')
    // 3 points: only the bearing-free case is absent, so no dash cells remain.
    expect(withElev).not.toContain(`(${dash})`)
  })

  it('formats table cells', () => {
    const text = raw(build({}, make(100, 50)))
    expect(text).toContain('(0+050)')
    expect(text).toContain('(0.00)')
    expect(text).toContain('(50.00)')
    expect(text).toContain('(90.0)')
  })

  it('attribution depends on elevationUsed', () => {
    const off = raw(build({ elevationUsed: false }))
    expect(off).toContain('OpenStreetMap contributors')
    expect(off).not.toContain('Open-Meteo')
    expect(raw(build({ elevationUsed: true }))).toContain('Open-Meteo')
  })

  it('does not read the clock for the date', () => {
    const a = raw(build({ generatedAt: new Date(2020, 0, 2, 3, 4) }))
    expect(a).toContain('Generated: 2020-01-02 03:04')
  })
})
