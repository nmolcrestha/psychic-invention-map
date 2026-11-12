import { abortError } from "../services/abort";
import { formatMapLabel, type ChainagePoint, type LatLng } from "../chainage";
import {
  TILE_SIZE,
  boundsOf,
  chooseZoom,
  projectToCanvas,
  tileRange,
  tileUrl,
  viewForBounds,
} from "./tiles";

export type MapSnapshot = { dataUrl: string; width: number; height: number };

export type CaptureOptions = {
  width?: number;
  height?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Resolves when the image has loaded; rejects on error or abort. */
  loadImage?: (url: string, signal?: AbortSignal) => Promise<CanvasImageSource>;
  createCanvas?: (width: number, height: number) => HTMLCanvasElement;
};

const MAX_TILES = 60;
const CONCURRENCY = 6;

function defaultLoadImage(
  url: string,
  signal?: AbortSignal,
): Promise<CanvasImageSource> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const onAbort = () => {
      img.src = "";
      reject(abortError());
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    img.onload = () => {
      signal?.removeEventListener("abort", onAbort);
      resolve(img);
    };
    img.onerror = () => {
      signal?.removeEventListener("abort", onAbort);
      reject(new Error("Tile failed to load"));
    };
    img.src = url;
  });
}

function defaultCreateCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
) {
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#ffffff";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = "#431407";
  ctx.fillText(text, x, y);
}

/**
 * Draws the alignment on OSM tiles in an off-screen canvas, fitted to the
 * alignment bounds. Never touches the live map. Returns null on any failure
 * (too many tiles, most tiles failing, timeout, tainted canvas...). Rejects
 * with an AbortError only when `signal` aborts.
 */
export async function captureMapSnapshot(
  vertices: LatLng[],
  points: ChainagePoint[],
  opts: CaptureOptions = {},
): Promise<MapSnapshot | null> {
  const {
    width = 1600,
    height = 1000,
    timeoutMs = 8000,
    signal,
    loadImage = defaultLoadImage,
    createCanvas = defaultCreateCanvas,
  } = opts;
  if (signal?.aborted) throw abortError();

  try {
    const bounds = boundsOf([...vertices, ...points]);
    if (!bounds) return null;
    const zoom = chooseZoom(bounds, width, height);
    const view = viewForBounds(bounds, zoom, width, height);
    const tiles = tileRange(view, width, height);
    if (tiles.length === 0 || tiles.length > MAX_TILES) return null;

    // Load tiles (limited concurrency) under an overall timeout.
    const inner = new AbortController();
    const onOuterAbort = () => inner.abort();
    signal?.addEventListener("abort", onOuterAbort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const images: (CanvasImageSource | null)[] = tiles.map(() => null);
    let settled = 0;
    let next = 0;
    const worker = async () => {
      while (next < tiles.length && !inner.signal.aborted) {
        const i = next++;
        try {
          images[i] = await loadImage(
            tileUrl(zoom, tiles[i].wx, tiles[i].y),
            inner.signal,
          );
        } catch {
          images[i] = null;
        }
        settled++;
      }
    };
    const loading = Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, tiles.length) }, worker),
    ).then(() => true);
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    });
    // Settles an abort promptly even if the loader ignores the signal.
    let onRaceAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_, reject) => {
      onRaceAbort = () => reject(abortError());
      signal?.addEventListener("abort", onRaceAbort, { once: true });
    });
    let finished: boolean;
    try {
      finished = await Promise.race([loading, timeout, aborted]);
    } finally {
      clearTimeout(timer);
      if (onRaceAbort) signal?.removeEventListener("abort", onRaceAbort);
      signal?.removeEventListener("abort", onOuterAbort);
      inner.abort();
    }
    if (signal?.aborted) throw abortError();
    if (!finished || settled < tiles.length) return null;
    const loaded = images.filter((im) => im !== null).length;
    if (loaded < tiles.length / 2) return null;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(0, 0, width, height);
    tiles.forEach((t, i) => {
      const im = images[i];
      if (!im) return;
      ctx.drawImage(
        im,
        t.x * TILE_SIZE - view.originX,
        t.y * TILE_SIZE - view.originY,
        TILE_SIZE,
        TILE_SIZE,
      );
    });

    if (vertices.length > 0) {
      ctx.beginPath();
      vertices.forEach((v, i) => {
        const p = projectToCanvas(v.lat, v.lng, view);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = "#2563eb";
      ctx.stroke();
    }

    const last = points.length - 1;
    const dot = (x: number, y: number, r: number, fill: string, stroke: string) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    };
    points.forEach((p, i) => {
      const c = projectToCanvas(p.lat, p.lng, view);
      if (i === 0) dot(c.x, c.y, 8, "#16a34a", "#14532d");
      else if (i === last) dot(c.x, c.y, 8, "#dc2626", "#7f1d1d");
      else dot(c.x, c.y, 4, "#fb923c", "#9a3412");
    });

    ctx.font = "600 20px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    points.forEach((p, i) => {
      if (!p.isInterval && i !== 0 && i !== last) return;
      const c = projectToCanvas(p.lat, p.lng, view);
      drawLabel(ctx, formatMapLabel(p.chainage), c.x + 12, c.y - 10);
    });

    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "right";
    drawLabel(ctx, "© OpenStreetMap contributors", width - 8, height - 8);

    return { dataUrl: canvas.toDataURL("image/png"), width, height };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    return null;
  }
}
