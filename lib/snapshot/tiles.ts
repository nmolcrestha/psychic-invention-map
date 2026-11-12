export const TILE_SIZE = 256;
export const MAX_ZOOM = 18;
const MAX_LAT = 85.0511287798;

export type LatLngLike = { lat: number; lng: number };
export type Bounds = { south: number; west: number; north: number; east: number };
export type View = { zoom: number; originX: number; originY: number };
export type TileRef = { x: number; y: number; wx: number };

export function worldSize(zoom: number): number {
  return TILE_SIZE * 2 ** zoom;
}

/** Web Mercator (EPSG:3857) world pixel coordinates at the given zoom. */
export function latLngToWorld(
  lat: number,
  lng: number,
  zoom: number,
): { x: number; y: number } {
  const size = worldSize(zoom);
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

export function worldToLatLng(x: number, y: number, zoom: number): LatLngLike {
  const size = worldSize(zoom);
  const lng = (x / size) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / size;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lng };
}

export function boundsOf(points: LatLngLike[]): Bounds | null {
  if (points.length === 0) return null;
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const p of points) {
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
  }
  return { south, west, north, east };
}

/**
 * Highest zoom (<= 18) at which the bounds, plus `padFraction` on each side,
 * fit in width x height. Degenerate (sub-pixel at z18) bounds give 17.
 */
export function chooseZoom(
  bounds: Bounds,
  width: number,
  height: number,
  padFraction = 0.08,
): number {
  const availW = width * (1 - 2 * padFraction);
  const availH = height * (1 - 2 * padFraction);
  const spanAt = (z: number) => {
    const a = latLngToWorld(bounds.north, bounds.west, z);
    const b = latLngToWorld(bounds.south, bounds.east, z);
    return { dx: Math.abs(b.x - a.x), dy: Math.abs(b.y - a.y) };
  };
  const top = spanAt(MAX_ZOOM);
  if (top.dx < 1 && top.dy < 1) return MAX_ZOOM - 1;
  for (let z = MAX_ZOOM; z >= 0; z--) {
    const { dx, dy } = spanAt(z);
    if (dx <= availW && dy <= availH) return z;
  }
  return 0;
}

/** View whose output window is centred on the bounds. */
export function viewForBounds(
  bounds: Bounds,
  zoom: number,
  width: number,
  height: number,
): View {
  const a = latLngToWorld(bounds.north, bounds.west, zoom);
  const b = latLngToWorld(bounds.south, bounds.east, zoom);
  return {
    zoom,
    originX: (a.x + b.x) / 2 - width / 2,
    originY: (a.y + b.y) / 2 - height / 2,
  };
}

export function projectToCanvas(
  lat: number,
  lng: number,
  view: View,
): { x: number; y: number } {
  const w = latLngToWorld(lat, lng, view.zoom);
  return { x: w.x - view.originX, y: w.y - view.originY };
}

/** Wrap a tile x index into 0..2^z-1 (antimeridian). */
export function wrapTileX(x: number, zoom: number): number {
  const n = 2 ** zoom;
  return ((x % n) + n) % n;
}

/**
 * Tiles covering the window. `x` is the unwrapped column (used for drawing),
 * `wx` the wrapped column (used in the URL). Rows outside 0..2^z-1 are skipped.
 */
export function tileRange(view: View, width: number, height: number): TileRef[] {
  const n = 2 ** view.zoom;
  const x0 = Math.floor(view.originX / TILE_SIZE);
  const x1 = Math.floor((view.originX + width - 1) / TILE_SIZE);
  const y0 = Math.floor(view.originY / TILE_SIZE);
  const y1 = Math.floor((view.originY + height - 1) / TILE_SIZE);
  const tiles: TileRef[] = [];
  for (let y = Math.max(0, y0); y <= Math.min(n - 1, y1); y++) {
    for (let x = x0; x <= x1; x++) {
      tiles.push({ x, y, wx: wrapTileX(x, view.zoom) });
    }
  }
  return tiles;
}

export function tileUrl(zoom: number, wx: number, y: number): string {
  return `https://tile.openstreetmap.org/${zoom}/${wx}/${y}.png`;
}
