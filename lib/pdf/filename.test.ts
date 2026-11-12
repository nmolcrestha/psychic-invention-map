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
    expect(sanitizeFileName('x'.repeat(300))).toBe(`${'x'.repeat(100)}-chainage.pdf`)
  })
  it('does not leave a trailing dash after truncation', () => {
    expect(sanitizeFileName(`${'x'.repeat(99)} yyyy`)).toBe(`${'x'.repeat(99)}-chainage.pdf`)
  })
  it('collapses separators after stripping illegal characters', () => {
    expect(sanitizeFileName('a / b')).toBe('a-b-chainage.pdf')
    expect(sanitizeFileName('a - - b')).toBe('a-b-chainage.pdf')
  })
  it('truncates by code points, not UTF-16 units', () => {
    expect(sanitizeFileName('\u{1F6A7}'.repeat(150))).toBe(`${'\u{1F6A7}'.repeat(100)}-chainage.pdf`)
  })
  it('strips bidi control characters', () => {
    expect(sanitizeFileName('a‮b⁦c⁩d‪')).toBe('abcd-chainage.pdf')
  })
})
