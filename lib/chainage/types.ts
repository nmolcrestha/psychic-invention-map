export interface LatLng {
  lat: number
  lng: number
}

export interface ChainagePoint {
  index: number
  /** Absolute chainage in metres. */
  chainage: number
  label: string
  /** True for a multiple of the interval (including a vertex that coincides with one). */
  isInterval: boolean
  lat: number
  lng: number
  /** Metres from the previous point; 0 for the first point. */
  distFromPrev: number
  /** Forward azimuth in degrees (0-360), or null if undefined. */
  bearing: number | null
  elevation?: number | null
}
