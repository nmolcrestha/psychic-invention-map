import type { LatLng } from '@/lib/chainage'

export type AlignmentMode = 'idle' | 'drawing'

export interface AlignmentState {
  vertices: LatLng[]
  mode: AlignmentMode
}

export type AlignmentAction =
  | { type: 'startDrawing' }
  | { type: 'addVertex'; vertex: LatLng }
  | { type: 'moveVertex'; index: number; vertex: LatLng }
  | { type: 'undo' }
  | { type: 'finish' }
  | { type: 'clear' }

export const initialAlignmentState: AlignmentState = {
  vertices: [],
  mode: 'idle',
}

export function alignmentReducer(
  state: AlignmentState,
  action: AlignmentAction,
): AlignmentState {
  switch (action.type) {
    case 'startDrawing':
      return state.mode === 'drawing' ? state : { ...state, mode: 'drawing' }
    case 'addVertex':
      // Vertices are only appended while drawing.
      if (state.mode !== 'drawing') return state
      return { ...state, vertices: [...state.vertices, action.vertex] }
    case 'moveVertex': {
      const { index, vertex } = action
      if (!Number.isInteger(index) || index < 0 || index >= state.vertices.length) {
        return state
      }
      const vertices = state.vertices.slice()
      vertices[index] = vertex
      return { ...state, vertices }
    }
    case 'undo':
      if (state.vertices.length === 0) return state
      return { ...state, vertices: state.vertices.slice(0, -1) }
    case 'finish':
      return state.mode === 'idle' ? state : { ...state, mode: 'idle' }
    case 'clear':
      return initialAlignmentState
  }
}
