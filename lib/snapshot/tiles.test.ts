import { describe, expect, it } from "vitest";
import {
  boundsOf,
  chooseZoom,
  latLngToWorld,
  projectToCanvas,
  tileRange,
  tileUrl,
  viewForBounds,
  worldToLatLng,
  wrapTileX,
} from "./tiles";

describe("latLngToWorld", () => {
  it("maps (0,0) at z0 to (128,128)", () => {
    const p = latLngToWorld(0, 0, 0);
    expect(p.x).toBeCloseTo(128, 6);
    expect(p.y).toBeCloseTo(128, 6);
  });
  it("maps the edges of the world", () => {
    expect(latLngToWorld(0, -180, 1).x).toBeCloseTo(0);
    expect(latLngToWorld(0, 180, 1).x).toBeCloseTo(512);
    expect(latLngToWorld(85.0511287798, 0, 0).y).toBeCloseTo(0, 4);
  });
  it("round-trips", () => {
    const w = latLngToWorld(27.7172, 85.324, 14);
    const ll = worldToLatLng(w.x, w.y, 14);
    expect(ll.lat).toBeCloseTo(27.7172, 8);
    expect(ll.lng).toBeCloseTo(85.324, 8);
  });
});

describe("chooseZoom", () => {
  it("picks the highest zoom that fits with padding", () => {
    const b = { south: 27.7, north: 27.72, west: 85.3, east: 85.33 };
    const z = chooseZoom(b, 1600, 1000);
    const fits = (zz: number) => {
      const a = latLngToWorld(b.north, b.west, zz);
      const c = latLngToWorld(b.south, b.east, zz);
      return c.x - a.x <= 1600 * 0.84 && c.y - a.y <= 1000 * 0.84;
    };
    expect(fits(z)).toBe(true);
    expect(fits(z + 1)).toBe(false);
  });
  it("clamps degenerate bounds to 17", () => {
    const b = { south: 27.7, north: 27.7, west: 85.3, east: 85.3 };
    expect(chooseZoom(b, 1600, 1000)).toBe(17);
  });
  it("never exceeds 18 for tiny non-degenerate bounds", () => {
    const b = { south: 27.7, north: 27.70002, west: 85.3, east: 85.30002 };
    expect(chooseZoom(b, 1600, 1000)).toBeLessThanOrEqual(18);
  });
  it("falls to a low zoom for world-sized bounds", () => {
    expect(
      chooseZoom({ south: -80, north: 80, west: -179, east: 179 }, 1600, 1000),
    ).toBeLessThanOrEqual(2);
  });
});

describe("view and projection", () => {
  it("centres the bounds in the window", () => {
    const b = { south: 27.7, north: 27.72, west: 85.3, east: 85.33 };
    const z = chooseZoom(b, 1600, 1000);
    const view = viewForBounds(b, z, 1600, 1000);
    const sw = projectToCanvas(b.south, b.west, view);
    const ne = projectToCanvas(b.north, b.east, view);
    expect((sw.x + ne.x) / 2).toBeCloseTo(800, 0);
    expect((sw.y + ne.y) / 2).toBeCloseTo(500, 0);
    expect(sw.x).toBeGreaterThanOrEqual(1600 * 0.08 - 1e-6);
    expect(sw.y).toBeLessThanOrEqual(1000 * 0.92 + 1e-6);
  });
});

describe("tileRange and wrapping", () => {
  it("covers the window", () => {
    const tiles = tileRange({ zoom: 3, originX: 100, originY: 100 }, 400, 300);
    expect(tiles.map((t) => [t.x, t.y])).toEqual([
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]);
  });
  it("covers the window with a fractional origin", () => {
    const tiles = tileRange({ zoom: 3, originX: 255.5, originY: 0.4 }, 2, 10);
    expect(tiles.map((t) => [t.x, t.y])).toEqual([
      [0, 0],
      [1, 0],
    ]);
    const edge = tileRange({ zoom: 3, originX: 255.5, originY: 0 }, 0.5, 10);
    expect(edge.map((t) => t.x)).toEqual([0]);
  });
  it("wraps x and skips rows out of range", () => {
    const tiles = tileRange({ zoom: 1, originX: -100, originY: -100 }, 600, 300);
    expect(tiles.every((t) => t.y >= 0 && t.y <= 1)).toBe(true);
    const first = tiles.find((t) => t.x === -1);
    expect(first?.wx).toBe(1);
  });
  it("wrapTileX", () => {
    expect(wrapTileX(-1, 3)).toBe(7);
    expect(wrapTileX(8, 3)).toBe(0);
    expect(wrapTileX(5, 3)).toBe(5);
  });
  it("builds OSM urls", () => {
    expect(tileUrl(5, 3, 4)).toBe("https://tile.openstreetmap.org/5/3/4.png");
  });
  it("boundsOf", () => {
    expect(boundsOf([])).toBeNull();
    expect(
      boundsOf([
        { lat: 1, lng: 5 },
        { lat: -2, lng: 3 },
      ]),
    ).toEqual({ south: -2, north: 1, west: 3, east: 5 });
  });
});

describe("viewForBounds origin", () => {
  it("is rounded to whole pixels", () => {
    const view = viewForBounds(
      { south: 27.7013, west: 85.3011, north: 27.7191, east: 85.3217 },
      14,
      1601,
      999,
    );
    expect(Number.isInteger(view.originX)).toBe(true);
    expect(Number.isInteger(view.originY)).toBe(true);
  });
});
