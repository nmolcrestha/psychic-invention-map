import { describe, expect, it, vi } from "vitest";
import { captureMapSnapshot } from "./captureMap";
import type { ChainagePoint } from "../chainage";

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
});
