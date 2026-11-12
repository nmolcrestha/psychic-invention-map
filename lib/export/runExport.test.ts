import { describe, expect, it, vi } from "vitest";
import { runExport, type ExportDeps } from "./runExport";
import type { ChainagePoint } from "../chainage/types";

const pt = (index: number): ChainagePoint => ({
  index,
  chainage: index * 100,
  label: `0+${String(index * 100).padStart(3, "0")}`,
  lat: 27 + index * 0.001,
  lng: 85,
  distFromPrev: index === 0 ? 0 : 100,
  bearing: 0,
  isInterval: true,
});
const points = [pt(0), pt(1), pt(2)];
const vertices = [
  { lat: 27, lng: 85 },
  { lat: 27.002, lng: 85 },
];
const IMG = { dataUrl: "data:image/png;base64,AAAA", width: 1600, height: 1000 };
const NOW = new Date(2026, 10, 12, 14, 30);

function setup(overrides: Partial<ExportDeps<string>> = {}) {
  const buildPdf = vi.fn((input: unknown) => (input ? "doc" : "doc"));
  const save = vi.fn();
  const deps: ExportDeps<string> = {
    fetchElevations: vi.fn(async () => ({
      elevations: [10, 20, 30],
      anyFailed: false,
    })),
    loadBuildPdf: async () => buildPdf as never,
    save,
    now: () => NOW,
    captureMap: vi.fn(async () => IMG),
    ...overrides,
  };
  return { deps, buildPdf, save };
}
const input = { name: "  My Road ", points, vertices, interval: 100 };

describe("runExport", () => {
  it("merges elevations, saves with the sanitised name and uses now()", async () => {
    const { deps, buildPdf, save } = setup();
    const res = await runExport(input, deps);
    expect(res).toEqual({
      fileName: "My-Road-chainage.pdf",
      elevationStatus: "ok",
      mapImageStatus: "ok",
    });
    const arg = buildPdf.mock.calls[0][0] as {
      points: ChainagePoint[];
      generatedAt: Date;
      elevationUsed: boolean;
      mapImage: unknown;
      projectName: string;
    };
    expect(arg.points.map((p) => p.elevation)).toEqual([10, 20, 30]);
    expect(arg.generatedAt).toBe(NOW);
    expect(arg.elevationUsed).toBe(true);
    expect(arg.mapImage).toBe(IMG);
    expect(arg.projectName).toBe("My Road");
    expect(points[0].elevation).toBeUndefined();
    expect(save).toHaveBeenCalledWith("doc", "My-Road-chainage.pdf");
  });

  it("reports failed when all elevations are null and still builds", async () => {
    const { deps, buildPdf, save } = setup({
      fetchElevations: async () => ({ elevations: [null, null, null], anyFailed: true }),
    });
    const res = await runExport(input, deps);
    expect(res.elevationStatus).toBe("failed");
    expect((buildPdf.mock.calls[0][0] as { elevationUsed: boolean }).elevationUsed).toBe(false);
    expect(save).toHaveBeenCalled();
  });

  it("reports partial when some elevations are null", async () => {
    const { deps, buildPdf } = setup({
      fetchElevations: async () => ({ elevations: [10, null, 30], anyFailed: true }),
    });
    const res = await runExport(input, deps);
    expect(res.elevationStatus).toBe("partial");
    expect((buildPdf.mock.calls[0][0] as { elevationUsed: boolean }).elevationUsed).toBe(true);
  });

  it("propagates errors from the PDF builder and does not save", async () => {
    const { deps, save } = setup({
      loadBuildPdf: async () => () => {
        throw new Error("boom");
      },
    });
    await expect(runExport(input, deps)).rejects.toThrow("boom");
    expect(save).not.toHaveBeenCalled();
  });

  it("falls back to all-null elevations when the fetch rejects (non-abort)", async () => {
    const { deps, buildPdf, save } = setup({
      fetchElevations: async () => {
        throw new TypeError("network");
      },
    });
    const res = await runExport(input, deps);
    expect(res.elevationStatus).toBe("failed");
    const arg = buildPdf.mock.calls[0][0] as { points: ChainagePoint[] };
    expect(arg.points.every((p) => p.elevation === null)).toBe(true);
    expect(save).toHaveBeenCalled();
  });

  it("rethrows AbortError and does not save", async () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    const { deps, save } = setup({
      fetchElevations: async () => {
        throw err;
      },
    });
    await expect(runExport(input, deps)).rejects.toBe(err);
    expect(save).not.toHaveBeenCalled();
  });

  it("builds without an image and reports unavailable when captureMap returns null", async () => {
    const { deps, buildPdf, save } = setup({ captureMap: async () => null });
    const res = await runExport(input, deps);
    expect(res.mapImageStatus).toBe("unavailable");
    expect((buildPdf.mock.calls[0][0] as { mapImage: unknown }).mapImage).toBeNull();
    expect(save).toHaveBeenCalled();
  });

  it("treats a non-abort captureMap error as no image", async () => {
    const { deps, save } = setup({
      captureMap: async () => {
        throw new Error("boom");
      },
    });
    const res = await runExport(input, deps);
    expect(res.mapImageStatus).toBe("unavailable");
    expect(save).toHaveBeenCalled();
  });

  it("rethrows an AbortError from captureMap and does not save", async () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    const { deps, save } = setup({
      captureMap: async () => {
        throw err;
      },
    });
    await expect(runExport(input, deps)).rejects.toBe(err);
    expect(save).not.toHaveBeenCalled();
  });

  it("passes the signal to fetchElevations and captureMap", async () => {
    const ac = new AbortController();
    const { deps } = setup();
    await runExport({ ...input, signal: ac.signal }, deps);
    expect(deps.fetchElevations).toHaveBeenCalledWith(expect.any(Array), {
      signal: ac.signal,
    });
    expect(deps.captureMap).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      { signal: ac.signal },
    );
  });

  it("does not save when aborted while the PDF builder loads", async () => {
    const ac = new AbortController();
    const { deps, buildPdf, save } = setup();
    deps.loadBuildPdf = async () => {
      ac.abort();
      return buildPdf as never;
    };
    await expect(
      runExport({ ...input, signal: ac.signal }, deps),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(save).not.toHaveBeenCalled();
  });

  it("does not save when aborted while building the PDF", async () => {
    const ac = new AbortController();
    const save = vi.fn();
    const { deps } = setup({
      loadBuildPdf: async () => () => {
        ac.abort();
        return "doc";
      },
      save,
    });
    await expect(
      runExport({ ...input, signal: ac.signal }, deps),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(save).not.toHaveBeenCalled();
  });
});
