import { describe, expect, it } from 'vitest'
import { generateChainage } from './generate'
import { EARTH_RADIUS_M } from './geo'
import { buildSummary } from './summary'
import type { LatLng } from './types'

const M_PER_DEG = (EARTH_RADIUS_M * Math.PI) / 180
const east = (metres: number): LatLng => ({ lat: 0, lng: metres / M_PER_DEG })

describe('buildSummary', () => {
  it('summarises a straight line', () => {
    const vertices = [east(0), east(250)]
    const { points } = generateChainage(vertices, 100, 35)
    const s = buildSummary(points, vertices, 100)
    expect(s.totalLengthM).toBeCloseTo(250, 4)
    expect(s.interval).toBe(100)
    expect(s.startLabel).toBe('0+035.00')
    expect(s.endLabel).toBe('0+285.00')
    expect(s.pointCount).toBe(4)
    expect(s.start).toEqual(vertices[0])
    expect(s.end).toEqual(vertices[1])
  })

  it('sums all segments', () => {
    const vertices = [east(0), east(100), east(300)]
    const { points } = generateChainage(vertices, 100, 0)
    expect(buildSummary(points, vertices, 100).totalLengthM).toBeCloseTo(300, 4)
  })

  it('handles empty input', () => {
    const s = buildSummary([], [], 100)
    expect(s).toMatchObject({
      totalLengthM: 0,
      startLabel: '',
      endLabel: '',
      pointCount: 0,
      start: null,
      end: null,
    })
  })
})
