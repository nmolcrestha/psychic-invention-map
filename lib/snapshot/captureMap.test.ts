import { describe, expect, it, vi } from "vitest";
import { captureMapSnapshot } from "./captureMap";
import type { ChainagePoint } from "../chainage";
import {
  TILE_SIZE,
  boundsOf,
  chooseZoom,
  projectToCanvas,
  tileRange,
  tileUrl,
  viewForBounds,
} from "./tiles";

const vertices = [
  { lat: 27.7, lng: 85.3 },
  { lat: 27.71, lng: 85.32 },
];
const mk = (index: number, isInterval: boolean): ChainagePoint => ({
  index,
  chainage: index * 100,
  label: "",
  lat: 27.7 + index * 0.003,
  lng: 85.3 + index * 0.006,
  distFromPrev: 100,
  bearing: 0,
  isInterval,
});
const points = [mk(0, true), mk(1, false), mk(2, true), mk(3, false)];

function fakeCanvas(toDataURL: () => string = () => "data:image/png;base64,AAAA") {
  const calls: { fn: string; args: unknown[] }[] = [];
  const ctx = new Proxy(
    {},
    {
      get:
        (_t, prop: string) =>
        (...args: unknown[]) => {
          calls.push({ fn: prop, args });
        },
      set: () => true,
    },
  );
  const canvas = { getContext: () => ctx, toDataURL } as unknown as HTMLCanvasElement;
  return { canvas, calls };
}

const okImage = async () => ({}) as CanvasImageSource;

describe("captureMapSnapshot", () => {
  it("returns a PNG data URL when tiles load and labels follow the map rule", async () => {
    const { canvas, calls } = fakeCanvas();
    const res = await captureMapSnapshot(vertices, points, {
      loadImage: okImage,
      createCanvas: () => canvas,
    });
    expect(res).toEqual({
      dataUrl: "data:image/png;base64,AAAA",
      width: 1600,
      height: 1000,
    });
    expect(calls.some((c) => c.fn === "drawImage")).toBe(true);
    const labels = calls.filter((c) => c.fn === "fillText").map((c) => c.args[0]);
    // interval points 0 and 2, last point (3), then the attribution
    expect(labels).toEqual([
      "0+000",
      "0+200",
      "0+300",
      "© OpenStreetMap contributors",
    ]);
  });

  it("limits tile concurrency", async () => {
    let active = 0;
    let peak = 0;
    const loadImage = async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 1));
      active--;
      return {} as CanvasImageSource;
    };
    await captureMapSnapshot(vertices, points, {
      loadImage,
      createCanvas: () => fakeCanvas().canvas,
    });
    expect(peak).toBeLessThanOrEqual(6);
  });

  it("returns null when most tiles fail", async () => {
    let n = 0;
    const loadImage = async () => {
      if (n++ % 4 !== 0) throw new Error("fail");
      return {} as CanvasImageSource;
    };
    const res = await captureMapSnapshot(vertices, points, {
      loadImage,
      createCanvas: () => fakeCanvas().canvas,
    });
    expect(res).toBeNull();
  });

  it("tolerates a few failed tiles", async () => {
    let n = 0;
    const loadImage = async () => {
      if (n++ === 0) throw new Error("fail");
      return {} as CanvasImageSource;
    };
    const res = await captureMapSnapshot(vertices, points, {
      loadImage,
      createCanvas: () => fakeCanvas().canvas,
    });
    expect(res).not.toBeNull();
  });

  it("returns null when toDataURL throws (tainted canvas)", async () => {
    const { canvas } = fakeCanvas(() => {
      throw new DOMException("tainted", "SecurityError");
    });
    const res = await captureMapSnapshot(vertices, points, {
      loadImage: okImage,
      createCanvas: () => canvas,
    });
    expect(res).toBeNull();
  });

  it("returns null on timeout", async () => {
    vi.useFakeTimers();
    try {
      const p = captureMapSnapshot(vertices, points, {
        timeoutMs: 100,
        loadImage: () => new Promise(() => {}),
        createCanvas: () => fakeCanvas().canvas,
      });
      await vi.advanceTimersByTimeAsync(200);
      await expect(p).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects with AbortError when the signal is aborted", async () => {
    const c = new AbortController();
    c.abort();
    await expect(
      captureMapSnapshot(vertices, points, { signal: c.signal, loadImage: okImage }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects with AbortError when aborted during tile loading, even if the loader ignores the signal", async () => {
    const c = new AbortController();
    const p = captureMapSnapshot(vertices, points, {
      signal: c.signal,
      loadImage: () => new Promise(() => {}), // never settles, ignores the signal
      createCanvas: () => fakeCanvas().canvas,
    });
    await Promise.resolve();
    c.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });

  it("requests the expected tile URLs at the chosen zoom", async () => {
    const urls: string[] = [];
    await captureMapSnapshot(vertices, points, {
      loadImage: async (url) => {
        urls.push(url);
        return {} as CanvasImageSource;
      },
      createCanvas: () => fakeCanvas().canvas,
    });
    const bounds = boundsOf([...vertices, ...points])!;
    const zoom = chooseZoom(bounds, 1600, 1000);
    const view = viewForBounds(bounds, zoom, 1600, 1000);
    const expected = tileRange(view, 1600, 1000).map((t) => tileUrl(zoom, t.wx, t.y));
    expect(expected.length).toBeGreaterThan(0);
    expect(urls.slice().sort()).toEqual(expected.slice().sort());
    expect(urls[0]).toMatch(/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
  });

  it("draws tiles at t*256 - origin, aligned with projected vertices", async () => {
    const { canvas, calls } = fakeCanvas();
    await captureMapSnapshot(vertices, points, {
      loadImage: okImage,
      createCanvas: () => canvas,
    });
    const bounds = boundsOf([...vertices, ...points])!;
    const zoom = chooseZoom(bounds, 1600, 1000);
    const view = viewForBounds(bounds, zoom, 1600, 1000);
    const tiles = tileRange(view, 1600, 1000);
    const draws = calls.filter((c) => c.fn === "drawImage");
    expect(draws).toHaveLength(tiles.length);
    tiles.forEach((t, i) => {
      expect(draws[i].args.slice(1)).toEqual([
        t.x * TILE_SIZE - view.originX,
        t.y * TILE_SIZE - view.originY,
        TILE_SIZE,
        TILE_SIZE,
      ]);
    });
    // The first vertex lies inside the tile drawn for it.
    const first = projectToCanvas(vertices[0].lat, vertices[0].lng, view);
    const move = calls.find((c) => c.fn === "moveTo")!;
    expect(move.args).toEqual([first.x, first.y]);
    const covering = draws.find((d) => {
      const [, x, y] = d.args as number[];
      return first.x >= x && first.x < x + TILE_SIZE && first.y >= y && first.y < y + TILE_SIZE;
    });
    expect(covering).toBeDefined();
  });

  it("returns null without loading when more than 60 tiles are needed", async () => {
    const loadImage = vi.fn(okImage);
    const res = await captureMapSnapshot(vertices, points, {
      width: 4000,
      height: 4000,
      loadImage,
      createCanvas: () => fakeCanvas().canvas,
    });
    expect(res).toBeNull();
    expect(loadImage).not.toHaveBeenCalled();
  });
});
