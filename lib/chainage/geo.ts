import type { LatLng } from './types'

/** WGS84 mean radius in metres. */
export const EARTH_RADIUS_M = 6_371_008.8

const toRad = (deg: number) => (deg * Math.PI) / 180
const toDeg = (rad: number) => (rad * 180) / Math.PI

/** Haversine great-circle distance in metres. */
export function distance(a: LatLng, b: LatLng): number {
  const phi1 = toRad(a.lat)
  const phi2 = toRad(b.lat)
  const dPhi = phi2 - phi1
  const dLambda = toRad(b.lng - a.lng)
  const h =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Initial bearing (forward azimuth) from a to b, normalised to [0, 360).
 * Note: bearing(p, p) returns 0, not an undefined value. Callers must check
 * for zero-length segments themselves before calling this.
 */
export function bearing(a: LatLng, b: LatLng): number {
  const phi1 = toRad(a.lat)
  const phi2 = toRad(b.lat)
  const dLambda = toRad(b.lng - a.lng)
  const y = Math.sin(dLambda) * Math.cos(phi2)
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda)
  const deg = (toDeg(Math.atan2(y, x)) + 360) % 360
  // Guard against floating point producing exactly 360.
  return deg >= 360 ? 0 : deg
}

/**
 * Point at `fraction` (0-1) along the great circle from a to b.
 * Zero-length (or antipodal-degenerate) segments return a copy of `a`.
 */
export function interpolate(a: LatLng, b: LatLng, fraction: number): LatLng {
  if (fraction <= 0) return { lat: a.lat, lng: a.lng }
  if (fraction >= 1) return { lat: b.lat, lng: b.lng }

  const phi1 = toRad(a.lat)
  const lam1 = toRad(a.lng)
  const phi2 = toRad(b.lat)
  const lam2 = toRad(b.lng)

  const delta = distance(a, b) / EARTH_RADIUS_M // angular distance
  const sinDelta = Math.sin(delta)
  if (!(sinDelta > 1e-12)) return { lat: a.lat, lng: a.lng }

  const A = Math.sin((1 - fraction) * delta) / sinDelta
  const B = Math.sin(fraction * delta) / sinDelta
  const x = A * Math.cos(phi1) * Math.cos(lam1) + B * Math.cos(phi2) * Math.cos(lam2)
  const y = A * Math.cos(phi1) * Math.sin(lam1) + B * Math.cos(phi2) * Math.sin(lam2)
  const z = A * Math.sin(phi1) + B * Math.sin(phi2)

  const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))
  const lng = toDeg(Math.atan2(y, x))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { lat: a.lat, lng: a.lng }
  }
  return { lat, lng }
}

/** Length in metres of each consecutive segment (vertices.length - 1 entries). */
export function segmentLengths(vertices: LatLng[]): number[] {
  const out: number[] = []
  for (let i = 1; i < vertices.length; i++) {
    out.push(distance(vertices[i - 1], vertices[i]))
  }
  return out
}
