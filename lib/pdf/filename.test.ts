import { describe, expect, it } from 'vitest'
import { sanitizeFileName } from './filename'

describe('sanitizeFileName', () => {
  it('replaces spaces with dashes', () => {
    expect(sanitizeFileName('My Road')).toBe('My-Road-chainage.pdf')
    expect(sanitizeFileName('a   b\tc')).toBe('a-b-c-chainage.pdf')
  })
  it('strips forbidden and control characters', () => {
    expect(sanitizeFileName('a\\b/c:d*e?f"g<h>i|j')).toBe('abcdefghij-chainage.pdf')
    expect(sanitizeFileName('a\u0000b\u001fc\u007f')).toBe('abc-chainage.pdf')
  })
  it('trims leading and trailing dots, dashes and spaces', () => {
    expect(sanitizeFileName('  ..--Road--..  ')).toBe('Road-chainage.pdf')
  })
  it('falls back when empty', () => {
    expect(sanitizeFileName('')).toBe('chainage.pdf')
    expect(sanitizeFileName('  ... ')).toBe('chainage.pdf')
    expect(sanitizeFileName('/:*?')).toBe('chainage.pdf')
  })
  it('limits the base length', () => {
    expect(sanitizeFileName('x'.repeat(300))).toBe(`${'x'.repeat(200)}-chainage.pdf`)
  })
  it('does not leave a trailing dash after truncation', () => {
    expect(sanitizeFileName(`${'x'.repeat(199)} yyyy`)).toBe(`${'x'.repeat(199)}-chainage.pdf`)
  })
  it('collapses separators after stripping illegal characters', () => {
    expect(sanitizeFileName('a / b')).toBe('a-b-chainage.pdf')
    expect(sanitizeFileName('a - - b')).toBe('a-b-chainage.pdf')
  })
  it('truncates by UTF-8 bytes on code point boundaries', () => {
    // 4 bytes each: 50 fit in 200 bytes, none is split in half.
    expect(sanitizeFileName('\u{1F6A7}'.repeat(150))).toBe(`${'\u{1F6A7}'.repeat(50)}-chainage.pdf`)
    // 3 bytes each: 66 fit (198 bytes).
    expect(sanitizeFileName('क'.repeat(100))).toBe(`${'क'.repeat(66)}-chainage.pdf`)
    // 2 bytes each: 100 fit.
    const base = sanitizeFileName('é'.repeat(300)).replace('-chainage.pdf', '')
    expect(new TextEncoder().encode(base).length).toBeLessThanOrEqual(200)
    expect(base).toBe('é'.repeat(100))
  })
  it('strips bidi control characters', () => {
    expect(sanitizeFileName('a‮b⁦c⁩d‪')).toBe('abcd-chainage.pdf')
  })
  it('strips LRM, RLM and Arabic letter mark', () => {
    expect(sanitizeFileName('a‎b‏c؜d')).toBe('abcd-chainage.pdf')
  })
})
