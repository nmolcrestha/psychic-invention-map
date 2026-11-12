/**
 * Format an absolute chainage (metres) as `km+mmm` (decimals = 0) or
 * `km+mmm.dd` (decimals = 2). Rounds first, then splits km and metres, so
 * 999.996 becomes `1+000.00` rather than `0+1000.00`.
 */
export function formatChainage(chainage: number, decimals: 0 | 2 = 0): string {
  const scale = decimals === 2 ? 100 : 1
  const total = Math.round(Math.max(0, chainage) * scale)
  const perKm = 1000 * scale
  const km = Math.floor(total / perKm)
  const rest = total - km * perKm
  const whole = Math.floor(rest / scale)
  let metres = String(whole).padStart(3, '0')
  if (decimals === 2) metres += `.${String(rest % scale).padStart(2, '0')}`
  return `${km}+${metres}`
}

/** Map-marker label: rounded to whole metres. */
export function formatMapLabel(chainage: number): string {
  return formatChainage(chainage, 0)
}
