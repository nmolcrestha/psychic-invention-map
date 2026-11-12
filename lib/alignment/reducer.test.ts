import { describe, expect, it } from 'vitest'
import {
  alignmentReducer,
  initialAlignmentState,
  type AlignmentState,
} from './reducer'

const a = { lat: 1, lng: 2 }
const b = { lat: 3, lng: 4 }
const c = { lat: 5, lng: 6 }

describe('alignmentReducer', () => {
  it('starts idle and empty', () => {
    expect(initialAlignmentState).toEqual({ vertices: [], mode: 'idle' })
  })

  it('startDrawing switches to drawing', () => {
    const s = alignmentReducer(initialAlignmentState, { type: 'startDrawing' })
    expect(s.mode).toBe('drawing')
  })

  it('addVertex appends while drawing', () => {
    let s = alignmentReducer(initialAlignmentState, { type: 'startDrawing' })
    s = alignmentReducer(s, { type: 'addVertex', vertex: a })
    s = alignmentReducer(s, { type: 'addVertex', vertex: b })
    expect(s.vertices).toEqual([a, b])
  })

  it('addVertex is ignored while idle', () => {
    const s = alignmentReducer(initialAlignmentState, { type: 'addVertex', vertex: a })
    expect(s).toBe(initialAlignmentState)
  })

  it('moveVertex replaces the vertex at index in either mode', () => {
    const idle: AlignmentState = { vertices: [a, b], mode: 'idle' }
    expect(
      alignmentReducer(idle, { type: 'moveVertex', index: 0, vertex: c }).vertices,
    ).toEqual([c, b])
    const drawing: AlignmentState = { vertices: [a, b], mode: 'drawing' }
    expect(
      alignmentReducer(drawing, { type: 'moveVertex', index: 1, vertex: c }).vertices,
    ).toEqual([a, c])
  })

  it('moveVertex does not mutate the previous state', () => {
    const prev: AlignmentState = { vertices: [a, b], mode: 'idle' }
    alignmentReducer(prev, { type: 'moveVertex', index: 0, vertex: c })
    expect(prev.vertices).toEqual([a, b])
  })

  it('moveVertex with an invalid index returns the same state', () => {
    const s: AlignmentState = { vertices: [a, b], mode: 'idle' }
    for (const index of [-1, 2, 99, 0.5, NaN]) {
      expect(alignmentReducer(s, { type: 'moveVertex', index, vertex: c })).toBe(s)
    }
    expect(
      alignmentReducer(initialAlignmentState, { type: 'moveVertex', index: 0, vertex: c }),
    ).toBe(initialAlignmentState)
  })

  it('undo removes the last vertex and keeps the mode', () => {
    const s: AlignmentState = { vertices: [a, b], mode: 'drawing' }
    expect(alignmentReducer(s, { type: 'undo' })).toEqual({
      vertices: [a],
      mode: 'drawing',
    })
  })

  it('undo on empty is a no-op', () => {
    expect(alignmentReducer(initialAlignmentState, { type: 'undo' })).toBe(
      initialAlignmentState,
    )
  })

  it('finish returns to idle and keeps vertices', () => {
    const s: AlignmentState = { vertices: [a, b], mode: 'drawing' }
    expect(alignmentReducer(s, { type: 'finish' })).toEqual({
      vertices: [a, b],
      mode: 'idle',
    })
  })

  it('finish while idle is a no-op', () => {
    const s: AlignmentState = { vertices: [a], mode: 'idle' }
    expect(alignmentReducer(s, { type: 'finish' })).toBe(s)
  })

  it('clear resets vertices and mode', () => {
    const s: AlignmentState = { vertices: [a, b], mode: 'drawing' }
    expect(alignmentReducer(s, { type: 'clear' })).toEqual(initialAlignmentState)
  })

  it('continue after finish appends to the end', () => {
    let s: AlignmentState = { vertices: [a, b], mode: 'drawing' }
    s = alignmentReducer(s, { type: 'finish' })
    s = alignmentReducer(s, { type: 'startDrawing' })
    s = alignmentReducer(s, { type: 'addVertex', vertex: c })
    expect(s).toEqual({ vertices: [a, b, c], mode: 'drawing' })
  })
})
