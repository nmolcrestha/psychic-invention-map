import { segmentLengths } from './geo'
import type { ChainagePoint, LatLng } from './types'

export interface ChainageSummary {
  /** Total alignment length in metres. */
  totalLengthM: number
  /** Interval in metres. */
  interval: number
  startLabel: string
  endLabel: string
  pointCount: number
  start: LatLng | null
  end: LatLng | null
}

/** Summary figures for the report, from the drawn vertices and generated points. */
export function buildSummary(
  points: ChainagePoint[],
  vertices: LatLng[],
  interval: number,
): ChainageSummary {
  const totalLengthM = segmentLengths(vertices).reduce((sum, len) => sum + len, 0)
  const first = vertices[0]
  const last = vertices[vertices.length - 1]
  return {
    totalLengthM,
    interval,
    startLabel: points.length > 0 ? points[0].label : '',
    endLabel: points.length > 0 ? points[points.length - 1].label : '',
    pointCount: points.length,
    start: first ? { lat: first.lat, lng: first.lng } : null,
    end: last ? { lat: last.lat, lng: last.lng } : null,
  }
}
