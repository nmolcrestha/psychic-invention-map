import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatGeneratedAt, hasUnsupportedChars } from './format'

describe('formatGeneratedAt', () => {
  afterEach(() => vi.restoreAllMocks())

  // getTimezoneOffset is minutes UTC is ahead of local time, so UTC+05:45 is -345.
  const withOffset = (utcOffsetMin: number) => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-utcOffsetMin)
  }

  it('formats a positive quarter-hour offset', () => {
    withOffset(345)
    expect(formatGeneratedAt(new Date(2026, 10, 12, 14, 30))).toBe('2026-11-12 14:30 (UTC+05:45)')
  })

  it('formats a positive half-hour offset', () => {
    withOffset(330)
    expect(formatGeneratedAt(new Date(2026, 10, 12, 14, 30))).toBe('2026-11-12 14:30 (UTC+05:30)')
  })

  it('formats negative half-hour offsets', () => {
    withOffset(-210)
    expect(formatGeneratedAt(new Date(2026, 10, 12, 14, 30))).toBe('2026-11-12 14:30 (UTC-03:30)')
    withOffset(-570)
    expect(formatGeneratedAt(new Date(2026, 10, 12, 14, 30))).toBe('2026-11-12 14:30 (UTC-09:30)')
  })

  it('formats a negative offset', () => {
    withOffset(-480)
    expect(formatGeneratedAt(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05 09:07 (UTC-08:00)')
  })

  it('formats a zero offset', () => {
    withOffset(0)
    expect(formatGeneratedAt(new Date(2026, 5, 1, 0, 0))).toBe('2026-06-01 00:00 (UTC+00:00)')
  })

  it('agrees with the runtime local offset', () => {
    const d = new Date(2026, 10, 12, 14, 30)
    const off = -d.getTimezoneOffset()
    const abs = Math.abs(off)
    const hh = String(Math.floor(abs / 60)).padStart(2, '0')
    const mm = String(abs % 60).padStart(2, '0')
    expect(formatGeneratedAt(d)).toBe(`2026-11-12 14:30 (UTC${off < 0 ? '-' : '+'}${hh}:${mm})`)
  })
})

describe('hasUnsupportedChars', () => {
  it('accepts ASCII, Latin-1 and the report symbols', () => {
    expect(hasUnsupportedChars('My Road 1')).toBe(false)
    expect(hasUnsupportedChars('Café Straße ° © · — ñ')).toBe(false)
    expect(hasUnsupportedChars('')).toBe(false)
  })

  it('flags other scripts, emoji and symbols', () => {
    expect(hasUnsupportedChars('सडक')).toBe(true)
    expect(hasUnsupportedChars('道路')).toBe(true)
    expect(hasUnsupportedChars('Road \u{1F6A7}')).toBe(true)
    expect(hasUnsupportedChars('Ł')).toBe(true)
  })
})
