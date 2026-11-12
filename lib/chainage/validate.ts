export interface ChainageInputErrors {
  interval?: string
  startChainage?: string
}

export type ChainageInputResult =
  | { ok: true; interval: number; startChainage: number }
  | { ok: false; errors: ChainageInputErrors }

/** Largest accepted start chainage in metres (10,000 km). */
export const MAX_START_CHAINAGE_M = 1e7

const NUMERIC = /^[+-]?(\d+(\.\d*)?|\.\d+)$/

function parse(raw: string): number | null {
  const s = raw.trim()
  if (!NUMERIC.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Validate the raw interval and start chainage strings from the form. */
export function validateChainageInputs(
  intervalRaw: string,
  startRaw: string,
): ChainageInputResult {
  const errors: ChainageInputErrors = {}

  let interval = 0
  if (intervalRaw.trim() === '') {
    errors.interval = 'Interval is required.'
  } else {
    const n = parse(intervalRaw)
    if (n === null) errors.interval = 'Interval must be a number.'
    else if (!Number.isInteger(n)) errors.interval = 'Interval must be a whole number of metres.'
    else if (n < 1) errors.interval = 'Interval must be at least 1 m.'
    else interval = n
  }

  let startChainage = 0
  if (startRaw.trim() === '') {
    errors.startChainage = 'Start chainage is required.'
  } else {
    const n = parse(startRaw)
    if (n === null) errors.startChainage = 'Start chainage must be a number.'
    else if (n < 0) errors.startChainage = 'Start chainage must be 0 or more.'
    else if (n > MAX_START_CHAINAGE_M) errors.startChainage = 'Start chainage is too large'
    else startChainage = n
  }

  if (errors.interval || errors.startChainage) return { ok: false, errors }
  return { ok: true, interval, startChainage }
}
