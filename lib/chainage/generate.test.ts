import { describe, expect, it } from 'vitest'
import { generateChainage } from './generate'
import { EARTH_RADIUS_M, distance, interpolate } from './geo'
import type { LatLng } from './types'

const M_PER_DEG = (EARTH_RADIUS_M * Math.PI) / 180

/** Point `metres` east of the origin along the equator. */
const east = (metres: number): LatLng => ({ lat: 0, lng: metres / M_PER_DEG })
const north = (metres: number): LatLng => ({ lat: metres / M_PER_DEG, lng: 0 })

describe('generateChainage', () => {
  it('straight 1 km line at 100 m gives 11 points', () => {
    const { points, limitExceeded } = generateChainage([east(0), east(1000)], 100, 0)
    expect(limitExceeded).toBe(false)
    expect(points).toHaveLength(11)
    expect(points.map((p) => p.label)).toEqual([
      '0+000', '0+100', '0+200', '0+300', '0+400', '0+500',
      '0+600', '0+700', '0+800', '0+900', '1+000',
    ])
    expect(points[0].distFromPrev).toBe(0)
    expect(points[5].distFromPrev).toBeCloseTo(100, 4)
    expect(points[10].bearing).toBeCloseTo(90, 6)
    expect(points.map((p) => p.index)).toEqual([...Array(11).keys()])
    const a = { lat: points[3].lat, lng: points[3].lng }
    expect(distance(east(0), a)).toBeCloseTo(300, 4)
  })

  it('start chainage 35 gives 35, 100, 200, ...', () => {
    const { points } = generateChainage([east(0), east(250)], 100, 35)
    expect(points.map((p) => Math.round(p.chainage * 1000) / 1000)).toEqual([35, 100, 200, 285])
    expect(points.map((p) => p.label)).toEqual(['0+035.00', '0+100', '0+200', '0+285.00'])
    expect(points[1].distFromPrev).toBeCloseTo(65, 4)
  })

  it('merges a vertex that coincides with an interval point, keeping the clean label', () => {
    const { points } = generateChainage([east(0), east(200), east(350)], 100, 0)
    expect(points.map((p) => p.label)).toEqual(['0+000', '0+100', '0+200', '0+300', '0+350.00'])
    // The merged vertex uses the outgoing segment bearing.
    expect(points[2].bearing).toBeCloseTo(90, 6)
  })

  it('keeps a non-interval vertex with a 2 dp label', () => {
    const { points } = generateChainage([east(0), east(150), north(0)], 100, 0)
    const vertex = points.find((p) => p.label === '0+150.00')
    expect(vertex).toBeDefined()
  })

  it('merges duplicate consecutive vertices and skips them for bearing', () => {
    const a = east(0)
    const b = east(150)
    const { points } = generateChainage([a, b, b, east(300)], 100, 0)
    expect(points.map((p) => p.label)).toEqual(['0+000', '0+100', '0+150.00', '0+200', '0+300'])
    for (const p of points) expect(p.bearing).toBeCloseTo(90, 6)
  })

  it('duplicate vertices at the end use the incoming segment bearing', () => {
    const b = east(150)
    const { points } = generateChainage([east(0), b, b], 100, 0)
    expect(points.at(-1)?.label).toBe('0+150.00')
    expect(points.at(-1)?.bearing).toBeCloseTo(90, 6)
  })

  it('has null bearing when every segment has zero length', () => {
    const a = east(10)
    const { points } = generateChainage([a, a], 100, 0)
    expect(points).toHaveLength(1)
    expect(points[0].bearing).toBeNull()
  })

  it('returns [] for 0 or 1 vertices', () => {
    expect(generateChainage([], 100, 0)).toEqual({ points: [], limitExceeded: false })
    expect(generateChainage([east(0)], 100, 0)).toEqual({ points: [], limitExceeded: false })
  })

  it('reports limitExceeded and no points over 2,000 points', () => {
    const r = generateChainage([east(0), east(3000)], 1, 0)
    expect(r.limitExceeded).toBe(true)
    expect(r.points).toEqual([])
  })

  it('allows a line just under the limit', () => {
    const r = generateChainage([east(0), east(1990)], 1, 0)
    expect(r.limitExceeded).toBe(false)
    expect(r.points).toHaveLength(1991)
  })

  it('chainage is monotonic and distFromPrev is non-negative', () => {
    const verts = [east(0), { lat: 0.002, lng: 0.003 }, { lat: 0.001, lng: 0.007 }, east(900)]
    const { points } = generateChainage(verts, 50, 12)
    expect(points.length).toBeGreaterThan(5)
    for (let i = 1; i < points.length; i++) {
      expect(points[i].chainage).toBeGreaterThan(points[i - 1].chainage)
      expect(points[i].distFromPrev).toBeGreaterThan(0)
    }
  })

  it('does not crash across the antimeridian', () => {
    const r = generateChainage(
      [{ lat: 0, lng: 179.999 }, { lat: 0, lng: -179.999 }],
      100,
      0,
    )
    expect(r.points.length).toBeGreaterThan(1)
  })

  it('does not loop forever on a huge start chainage', () => {
    const r = generateChainage([east(0), east(100)], 1, 1e17)
    expect(r.limitExceeded).toBe(false)
    expect(r.points.length).toBeGreaterThan(1)
  })

  it('allows exactly 2,000 points and rejects 2,001', () => {
    const ok = generateChainage([east(0), east(1999)], 1, 0)
    expect(ok.limitExceeded).toBe(false)
    expect(ok.points).toHaveLength(2000)
    const bad = generateChainage([east(0), east(2000)], 1, 0)
    expect(bad.limitExceeded).toBe(true)
    expect(bad.points).toEqual([])
  })

  it('does not over-count a 1,997 m line at 1 m', () => {
    const r = generateChainage([east(0), east(1997)], 1, 0)
    expect(r.limitExceeded).toBe(false)
    expect(r.points).toHaveLength(1998)
  })

  it('counts vertices on interval multiples once near the boundary', () => {
    const r = generateChainage([east(0), east(1000), east(1999)], 1, 0)
    expect(r.limitExceeded).toBe(false)
    expect(r.points).toHaveLength(2000)
  })

  it('counts off-interval vertices after merging at the boundary', () => {
    const one = generateChainage([east(0), east(500.5), east(1998)], 1, 0)
    expect(one.limitExceeded).toBe(false)
    expect(one.points).toHaveLength(2000)
    const two = generateChainage([east(0), east(500.5), east(900.5), east(1998)], 1, 0)
    expect(two.limitExceeded).toBe(true)
    expect(two.points).toEqual([])
  })

  it('emits no two points within 0.01 m when a group spans vertices', () => {
    const { points } = generateChainage(
      [east(0), east(100.009), east(100.015), east(300)],
      100,
      0,
    )
    expect(points.map((p) => p.label)).toEqual(['0+000', '0+100', '0+200', '0+300'])
    for (const p of points.slice(1)) expect(p.distFromPrev).toBeGreaterThan(0.01)
  })

  it('ignores a 5 mm jog when picking the bearing', () => {
    const jog = { lat: 0.005 / M_PER_DEG, lng: east(50).lng }
    const { points } = generateChainage([east(0), east(50), jog, east(200)], 100, 0)
    for (const p of points) expect(p.bearing).toBeCloseTo(90, 0)
    const v = points.find((p) => p.label === '0+050.00')
    expect(v?.bearing).toBeCloseTo(90, 0)
  })

  it('places points on the great circle on a high-latitude diagonal', () => {
    const a = { lat: 60, lng: 10 }
    const b = { lat: 60.2, lng: 10.6 }
    const total = distance(a, b)
    const { points } = generateChainage([a, b], 1000, 0)
    expect(points.length).toBeGreaterThan(5)
    for (const p of points.slice(1, -1)) {
      const want = interpolate(a, b, p.chainage / total)
      expect(p.lat).toBeCloseTo(want.lat, 7)
      expect(p.lng).toBeCloseTo(want.lng, 7)
    }
    expect(points.at(-1)?.lat).toBeCloseTo(b.lat, 9)
  })

  it('merges an interval multiple just past the end into the end vertex', () => {
    const end = east(249.995)
    const { points } = generateChainage([east(0), end], 50, 0)
    expect(points.map((p) => p.label)).toEqual([
      '0+000', '0+050', '0+100', '0+150', '0+200', '0+250',
    ])
    const last = points.at(-1)!
    expect(last.chainage).toBe(250)
    expect(last.lat).toBe(end.lat)
    expect(last.lng).toBe(end.lng)
    expect(last.distFromPrev).toBeCloseTo(49.995, 3)
  })
})
