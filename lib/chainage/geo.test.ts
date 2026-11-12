import { describe, expect, it } from 'vitest'
import { bearing, distance, interpolate, segmentLengths } from './geo'

describe('distance', () => {
  it('1 degree of longitude at the equator is about 111,195 m', () => {
    expect(distance({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111_195, -1)
  })

  it('London to Paris is about 343.5 km', () => {
    const london = { lat: 51.5074, lng: -0.1278 }
    const paris = { lat: 48.8566, lng: 2.3522 }
    const d = distance(london, paris)
    expect(d).toBeGreaterThan(342_000)
    expect(d).toBeLessThan(345_000)
  })

  it('identical points give 0', () => {
    expect(distance({ lat: 27.7, lng: 85.3 }, { lat: 27.7, lng: 85.3 })).toBe(0)
  })

  it('antimeridian inputs are finite and short', () => {
    const d = distance({ lat: 0, lng: 179.9 }, { lat: 0, lng: -179.9 })
    expect(Number.isFinite(d)).toBe(true)
    expect(d).toBeCloseTo(22_239, -2)
  })
})

describe('bearing', () => {
  const o = { lat: 0, lng: 0 }
  it('cardinal directions', () => {
    expect(bearing(o, { lat: 1, lng: 0 })).toBeCloseTo(0, 6)
    expect(bearing(o, { lat: 0, lng: 1 })).toBeCloseTo(90, 6)
    expect(bearing(o, { lat: -1, lng: 0 })).toBeCloseTo(180, 6)
    expect(bearing(o, { lat: 0, lng: -1 })).toBeCloseTo(270, 6)
  })

  it('wraps near 359', () => {
    const b = bearing(o, { lat: 1, lng: -0.01 })
    expect(b).toBeGreaterThan(358)
    expect(b).toBeLessThan(360)
  })

  it('is finite across the antimeridian', () => {
    const b = bearing({ lat: 0, lng: 179.9 }, { lat: 0, lng: -179.9 })
    expect(b).toBeCloseTo(90, 6)
  })
})

describe('interpolate', () => {
  const a = { lat: 10, lng: 20 }
  const b = { lat: 12, lng: 25 }

  it('fractions 0 and 1 return the endpoints', () => {
    expect(interpolate(a, b, 0)).toEqual(a)
    expect(interpolate(a, b, 1)).toEqual(b)
  })

  it('midpoint is equidistant from both ends', () => {
    const m = interpolate(a, b, 0.5)
    const total = distance(a, b)
    expect(distance(a, m)).toBeCloseTo(total / 2, 3)
    expect(distance(m, b)).toBeCloseTo(total / 2, 3)
  })

  it('identical points return that point with no NaN', () => {
    const p = { lat: 27.7, lng: 85.3 }
    const r = interpolate(p, p, 0.5)
    expect(r).toEqual(p)
    expect(Number.isNaN(r.lat) || Number.isNaN(r.lng)).toBe(false)
  })

  it('antimeridian gives finite values', () => {
    const r = interpolate({ lat: 0, lng: 179.9 }, { lat: 0, lng: -179.9 }, 0.5)
    expect(Number.isFinite(r.lat)).toBe(true)
    expect(Number.isFinite(r.lng)).toBe(true)
    expect(Math.abs(r.lng)).toBeCloseTo(180, 6)
  })
})

describe('segmentLengths', () => {
  it('returns one length per segment', () => {
    const v = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
      { lat: 0, lng: 1 },
    ]
    const l = segmentLengths(v)
    expect(l).toHaveLength(2)
    expect(l[1]).toBe(0)
    expect(segmentLengths([])).toEqual([])
  })
})
