/** `2026-11-12 14:30 (UTC+05:45)`, in the date's local time. */
export function formatGeneratedAt(date: Date): string {
  const p2 = (n: number) => String(n).padStart(2, '0')
  const offsetMin = -date.getTimezoneOffset()
  const sign = offsetMin < 0 ? '-' : '+'
  const abs = Math.abs(offsetMin)
  const stamp =
    `${date.getFullYear()}-${p2(date.getMonth() + 1)}-${p2(date.getDate())} ` +
    `${p2(date.getHours())}:${p2(date.getMinutes())}`
  return `${stamp} (UTC${sign}${p2(Math.floor(abs / 60))}:${p2(abs % 60)})`
}

// Windows-1252 code points above Latin-1 that the built-in PDF fonts can draw.
const CP1252_EXTRAS = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
  0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178,
])

/** True if the text has characters outside WinAnsi/Latin-1 that built-in PDF fonts cannot render. */
export function hasUnsupportedChars(text: string): boolean {
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    if (c === 0x09 || c === 0x0a || c === 0x0d) continue
    if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff)) continue
    if (CP1252_EXTRAS.has(c)) continue
    return true
  }
  return false
}
