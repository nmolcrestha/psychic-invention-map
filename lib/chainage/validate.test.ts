import { describe, expect, it } from 'vitest'
import { validateChainageInputs } from './validate'

describe('validateChainageInputs', () => {
  it('parses valid values', () => {
    expect(validateChainageInputs(' 100 ', '35.5')).toEqual({
      ok: true,
      interval: 100,
      startChainage: 35.5,
    })
    expect(validateChainageInputs('1', '0')).toEqual({ ok: true, interval: 1, startChainage: 0 })
  })

  it('requires both fields', () => {
    const r = validateChainageInputs('', '  ')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.interval).toMatch(/required/)
      expect(r.errors.startChainage).toMatch(/required/)
    }
  })

  it('rejects non-numeric, fractional and < 1 intervals', () => {
    for (const bad of ['abc', '1e2', '0x10', 'NaN', 'Infinity', '10.5', '0', '-5']) {
      const r = validateChainageInputs(bad, '0')
      expect(r.ok, bad).toBe(false)
      if (!r.ok) expect(r.errors.interval, bad).toBeTruthy()
    }
  })

  it('accepts a whole number written with a trailing decimal point', () => {
    expect(validateChainageInputs('10.', '0').ok).toBe(true)
  })

  it('rejects negative or non-numeric start chainage', () => {
    for (const bad of ['-1', 'x', '1,5']) {
      const r = validateChainageInputs('100', bad)
      expect(r.ok, bad).toBe(false)
      if (!r.ok) {
        expect(r.errors.startChainage, bad).toBeTruthy()
        expect(r.errors.interval).toBeUndefined()
      }
    }
  })

  it('rejects a start chainage above 10,000 km', () => {
    for (const bad of ['10000001', '1e17', '100000000000000000']) {
      const r = validateChainageInputs('1', bad)
      expect(r.ok, bad).toBe(false)
    }
    const r = validateChainageInputs('1', '100000000000000000')
    if (!r.ok) expect(r.errors.startChainage).toBe('Start chainage is too large')
    expect(validateChainageInputs('1', '10000000').ok).toBe(true)
  })
})
