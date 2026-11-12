const MAX_BASE_BYTES = 200
const encoder = new TextEncoder()

/** Longest prefix of `s` within `maxBytes` of UTF-8, cut only between code points. */
function truncateUtf8(s: string, maxBytes: number): string {
  let bytes = 0
  let out = ''
  for (const ch of s) {
    bytes += encoder.encode(ch).length
    if (bytes > maxBytes) break
    out += ch
  }
  return out
}

/** `My Road` becomes `My-Road-chainage.pdf`; `chainage.pdf` if nothing usable remains. */
export function sanitizeFileName(name: string): string {
  const trim = (s: string) => s.replace(/^[.\s-]+|[.\s-]+$/g, '')
  // Tab, LF and CR are left in so they collapse to a dash like other whitespace.
  // Bidi controls removed: U+202A-202E, U+2066-2069, U+200E, U+200F, U+061C.
  const cleaned = name
    .replace(
      /[\\/:*?"<>|\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f‪-‮⁦-⁩‎‏؜]/g,
      '',
    )
    .replace(/[\s-]+/g, '-')
  const base = trim(truncateUtf8(trim(cleaned), MAX_BASE_BYTES))
  return base ? `${base}-chainage.pdf` : 'chainage.pdf'
}
