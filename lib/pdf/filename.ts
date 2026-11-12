const MAX_BASE = 100

/** `My Road` becomes `My-Road-chainage.pdf`; `chainage.pdf` if nothing usable remains. */
export function sanitizeFileName(name: string): string {
  const trim = (s: string) => s.replace(/^[.\s-]+|[.\s-]+$/g, '')
  // Tab, LF and CR are left in so they collapse to a dash like other whitespace.
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f‪-‮⁦-⁩]/g, '')
    .replace(/[\s-]+/g, '-')
  const base = trim(Array.from(trim(cleaned)).slice(0, MAX_BASE).join(''))
  return base ? `${base}-chainage.pdf` : 'chainage.pdf'
}
