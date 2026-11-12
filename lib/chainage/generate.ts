import { bearing, interpolate, segmentLengths } from './geo'
import { formatChainage } from './format'
import type { ChainagePoint, LatLng } from './types'

export const MAX_POINTS = 2000
/** Points closer than this (metres) along the line are merged. */
const MERGE_EPS_M = 0.01

export interface ChainageResult {
  points: ChainagePoint[]
  limitExceeded: boolean
}

interface Candidate {
  /** Metres along the line from its start. */
  s: number
  kind: 'vertex' | 'interval'
  /** Vertex index (vertex) or segment index (interval). */
  idx: number
  /** Absolute chainage for interval candidates. */
  chainage?: number
}

/**
 * Chainage points at the start, at absolute multiples of `interval`, at every
 * vertex and at the end. Returns no points when the 2,000-point limit would be
 * exceeded.
 */
export function generateChainage(
  vertices: LatLng[],
  interval: number,
  startChainage: number,
): ChainageResult {
  const empty: ChainageResult = { points: [], limitExceeded: false }
  if (vertices.length < 2) return empty
  if (!Number.isFinite(interval) || interval < 1) return empty
  if (!Number.isFinite(startChainage) || startChainage < 0) return empty

  const lengths = segmentLengths(vertices)
  const cum: number[] = [0]
  for (const len of lengths) cum.push(cum[cum.length - 1] + len)
  const total = cum[cum.length - 1]

  // Interval points never merge with each other, so this is an exact lower
  // bound on the final count. Reject before allocating anything.
  const k0 = Math.ceil(startChainage / interval)
  const kEnd = Math.floor((startChainage + total + MERGE_EPS_M) / interval)
  if (kEnd - k0 + 1 > MAX_POINTS) {
    return { points: [], limitExceeded: true }
  }

  const candidates: Candidate[] = vertices.map((_, i) => ({
    s: cum[i],
    kind: 'vertex',
    idx: i,
  }))

  let seg = 0
  for (let n = 0; n < kEnd - k0 + 1; n++) {
    // Counting by n always terminates, even where k0 + 1 === k0 in floats.
    const c = (k0 + n) * interval
    const s = Math.min(Math.max(c - startChainage, 0), total)
    while (seg < lengths.length - 1 && cum[seg + 1] < s) seg++
    candidates.push({ s, kind: 'interval', idx: seg, chainage: c })
  }

  // Stable sort keeps vertices in index order for equal positions.
  candidates.sort((a, b) => a.s - b.s)

  // Outgoing segment from idx, else the nearest earlier one; zero-length
  // segments are skipped (bearing(p, p) would wrongly return 0).
  const bearingFor = (idx: number): number | null => {
    for (let j = idx; j < lengths.length; j++) {
      if (lengths[j] > MERGE_EPS_M) return bearing(vertices[j], vertices[j + 1])
    }
    for (let j = Math.min(idx, lengths.length) - 1; j >= 0; j--) {
      if (lengths[j] > MERGE_EPS_M) return bearing(vertices[j], vertices[j + 1])
    }
    return null
  }

  const points: ChainagePoint[] = []
  let prevS = 0
  let i = 0
  while (i < candidates.length) {
    const groupStart = candidates[i].s
    let j = i
    while (j + 1 < candidates.length && candidates[j + 1].s - groupStart <= MERGE_EPS_M) j++
    let group = candidates.slice(i, j + 1)
    let vertex = group.find((c) => c.kind === 'vertex')
    let intervalPt = group.find((c) => c.kind === 'interval')
    let anchor = vertex ?? intervalPt!
    // The emitted position is the anchor's, so absorb anything within the
    // merge distance of it too; no two emitted points end up closer than that.
    while (j + 1 < candidates.length && candidates[j + 1].s - anchor.s <= MERGE_EPS_M) {
      j++
      group = candidates.slice(i, j + 1)
      vertex = group.find((c) => c.kind === 'vertex')
      intervalPt = group.find((c) => c.kind === 'interval')
      anchor = vertex ?? intervalPt!
    }
    i = j + 1
    const s = anchor.s

    let pos: LatLng
    if (vertex) {
      pos = vertices[vertex.idx]
    } else {
      const len = lengths[anchor.idx]
      pos =
        len > 0
          ? interpolate(vertices[anchor.idx], vertices[anchor.idx + 1], (s - cum[anchor.idx]) / len)
          : vertices[anchor.idx]
    }

    // A coinciding interval point supplies the clean chainage and label.
    const chainage = intervalPt ? intervalPt.chainage! : startChainage + s
    points.push({
      index: points.length,
      chainage,
      label: formatChainage(chainage, intervalPt ? 0 : 2),
      lat: pos.lat,
      lng: pos.lng,
      distFromPrev: points.length === 0 ? 0 : s - prevS,
      bearing: bearingFor(anchor.idx),
    })
    prevS = s
  }

  if (points.length > MAX_POINTS) return { points: [], limitExceeded: true }
  return { points, limitExceeded: false }
}
