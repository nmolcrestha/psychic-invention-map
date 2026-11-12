import { describe, expect, it } from 'vitest'
import { formatChainage, formatMapLabel } from './format'

describe('formatChainage', () => {
  it('formats interval points without decimals', () => {
    expect(formatChainage(0)).toBe('0+000')
    expect(formatChainage(1250)).toBe('1+250')
    expect(formatChainage(12005)).toBe('12+005')
  })

  it('formats other points with 2 dp', () => {
    expect(formatChainage(1250.37, 2)).toBe('1+250.37')
    expect(formatChainage(5, 2)).toBe('0+005.00')
    expect(formatChainage(0.05, 2)).toBe('0+000.05')
  })

  it('rounds before splitting km and metres', () => {
    expect(formatChainage(999.996, 2)).toBe('1+000.00')
    expect(formatChainage(999.6, 0)).toBe('1+000')
    expect(formatChainage(11999.999, 2)).toBe('12+000.00')
  })
})

describe('formatMapLabel', () => {
  it('rounds to whole metres', () => {
    expect(formatMapLabel(1250.37)).toBe('1+250')
    expect(formatMapLabel(1250.5)).toBe('1+251')
    expect(formatMapLabel(999.7)).toBe('1+000')
  })
})
