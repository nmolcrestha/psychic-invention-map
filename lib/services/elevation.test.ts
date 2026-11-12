import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildElevationUrl, fetchElevations } from "./elevation";
import { isAbortError } from "./abort";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function makePoints(n: number) {
  return Array.from({ length: n }, (_, i) => ({ lat: 10 + i / 1000, lng: 20 + i / 1000 }));
}

/** Echoes elevation = latitude index based value: the point's lat * 1000 rounded. */
function echoFetch() {
  return vi.fn(async (url: unknown) => {
    const lat = new URL(String(url)).searchParams.get("latitude")!.split(",");
    return jsonResponse({ elevation: lat.map((l) => Math.round((Number(l) - 10) * 1000)) });
  });
}

function asFetch(fn: unknown): typeof fetch {
  return fn as typeof fetch;
}

describe("fetchElevations", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it("splits 250 points into batches of 100, 100 and 50, in order", async () => {
    const fetchFn = echoFetch();
    const points = makePoints(250);
    const result = await fetchElevations(points, { fetchFn: asFetch(fetchFn) });

    expect(fetchFn).toHaveBeenCalledTimes(3);
    const sizes = fetchFn.mock.calls.map(
      (c) => new URL(String(c[0])).searchParams.get("latitude")!.split(",").length,
    );
    expect(sizes).toEqual([100, 100, 50]);
    const first = new URL(String(fetchFn.mock.calls[0][0]));
    expect(first.origin + first.pathname).toBe("https://api.open-meteo.com/v1/elevation");
    expect(first.searchParams.get("longitude")!.split(",")[0]).toBe("20");
    expect(result.elevations).toEqual(points.map((_, i) => i));
    expect(result.anyFailed).toBe(false);
  });

  it("rounds coordinates to 6 dp in the URL", () => {
    const url = new URL(buildElevationUrl([{ lat: 27.123456789, lng: -85.9876543 }]));
    expect(url.searchParams.get("latitude")).toBe("27.123457");
    expect(url.searchParams.get("longitude")).toBe("-85.987654");
  });

  it("gives nulls for a batch with HTTP 500 only", async () => {
    let call = 0;
    const fetchFn = vi.fn(async (url: unknown) => {
      call++;
      if (call === 2) return new Response("err", { status: 500 });
      const n = new URL(String(url)).searchParams.get("latitude")!.split(",").length;
      return jsonResponse({ elevation: Array(n).fill(5) });
    });
    const { elevations, anyFailed } = await fetchElevations(makePoints(250), {
      fetchFn: asFetch(fetchFn),
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(elevations.slice(0, 100).every((e) => e === 5)).toBe(true);
    expect(elevations.slice(100, 200).every((e) => e === null)).toBe(true);
    expect(elevations.slice(200).every((e) => e === 5)).toBe(true);
    expect(anyFailed).toBe(true);
  });

  it("times out one batch while later batches still succeed", async () => {
    let call = 0;
    const abortRejection = () => {
      const e = new Error("aborted");
      e.name = "AbortError";
      return e;
    };
    const fetchFn = vi.fn((url: unknown, init?: RequestInit) => {
      call++;
      if (call === 1) {
        return new Promise<Response>((_, reject) => {
          const signal = init?.signal;
          if (signal?.aborted) return reject(abortRejection());
          signal?.addEventListener("abort", () => reject(abortRejection()));
        });
      }
      const n = new URL(String(url)).searchParams.get("latitude")!.split(",").length;
      return Promise.resolve(jsonResponse({ elevation: Array(n).fill(7) }));
    });
    let settled = false;
    const promise = fetchElevations(makePoints(150), {
      fetchFn: asFetch(fetchFn),
      timeoutMs: 3_000,
    }).finally(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(2_999);
    expect(settled).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    const { elevations, anyFailed } = await promise;
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(elevations.slice(0, 100).every((e) => e === null)).toBe(true);
    expect(elevations.slice(100).every((e) => e === 7)).toBe(true);
    expect(anyFailed).toBe(true);
  });

  it("removes its listeners from the external signal", async () => {
    const ac = new AbortController();
    const add = vi.spyOn(ac.signal, "addEventListener");
    const remove = vi.spyOn(ac.signal, "removeEventListener");
    await fetchElevations(makePoints(250), {
      fetchFn: asFetch(echoFetch()),
      signal: ac.signal,
    });
    expect(add).toHaveBeenCalledTimes(3);
    expect(remove).toHaveBeenCalledTimes(3);
    for (const [i, call] of add.mock.calls.entries()) {
      expect(remove.mock.calls[i][1]).toBe(call[1]);
    }
  });

  it("clamps batchSize to 1..100 and ignores non-finite values", async () => {
    const sizesFor = async (batchSize: number, n: number) => {
      const fetchFn = echoFetch();
      await fetchElevations(makePoints(n), { fetchFn: asFetch(fetchFn), batchSize });
      return fetchFn.mock.calls.map(
        (c) => new URL(String(c[0])).searchParams.get("latitude")!.split(",").length,
      );
    };
    expect(await sizesFor(500, 150)).toEqual([100, 50]);
    expect(await sizesFor(0, 2)).toEqual([1, 1]);
    expect(await sizesFor(Infinity, 150)).toEqual([100, 50]);
    expect(await sizesFor(NaN, 150)).toEqual([100, 50]);
  });

  it("gives nulls for malformed JSON", async () => {
    const fetchFn = vi.fn(async () => new Response("{not json", { status: 200 }));
    const result = await fetchElevations(makePoints(3), { fetchFn: asFetch(fetchFn) });
    expect(result).toEqual({ elevations: [null, null, null], anyFailed: true });
  });

  it("gives nulls for a wrong-length array", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ elevation: [1, 2] }));
    const result = await fetchElevations(makePoints(3), { fetchFn: asFetch(fetchFn) });
    expect(result).toEqual({ elevations: [null, null, null], anyFailed: true });
  });

  it("gives nulls when the elevation field is missing", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ error: true }));
    const result = await fetchElevations(makePoints(2), { fetchFn: asFetch(fetchFn) });
    expect(result.elevations).toEqual([null, null]);
  });

  it("nulls only the non-finite value when the length is right", async () => {
    const fetchFn = vi.fn(
      async () => new Response('{"elevation":[1,null,"x",4]}', { status: 200 }),
    );
    const result = await fetchElevations(makePoints(4), { fetchFn: asFetch(fetchFn) });
    expect(result.elevations).toEqual([1, null, null, 4]);
    expect(result.anyFailed).toBe(true);
  });

  it("gives nulls on a network error", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await fetchElevations(makePoints(2), { fetchFn: asFetch(fetchFn) });
    expect(result).toEqual({ elevations: [null, null], anyFailed: true });
  });

  it("returns empty for empty input without fetching", async () => {
    const fetchFn = vi.fn();
    const result = await fetchElevations([], { fetchFn: asFetch(fetchFn) });
    expect(result).toEqual({ elevations: [], anyFailed: false });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("rejects with an AbortError when the external signal aborts mid-request", async () => {
    const fetchFn = vi.fn((_url: unknown, init?: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const e = new Error("aborted");
          e.name = "AbortError";
          reject(e);
        });
      });
    });
    const ac = new AbortController();
    const promise = fetchElevations(makePoints(250), {
      fetchFn: asFetch(fetchFn),
      signal: ac.signal,
    }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(100);
    ac.abort();
    expect(isAbortError(await promise)).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("rejects without fetching when the signal is already aborted", async () => {
    const fetchFn = vi.fn();
    const ac = new AbortController();
    ac.abort();
    await expect(
      fetchElevations(makePoints(2), { fetchFn: asFetch(fetchFn), signal: ac.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("does not return partial results when aborted between batches", async () => {
    const ac = new AbortController();
    const fetchFn = vi.fn(async (url: unknown) => {
      ac.abort();
      const n = new URL(String(url)).searchParams.get("latitude")!.split(",").length;
      return jsonResponse({ elevation: Array(n).fill(1) });
    });
    await expect(
      fetchElevations(makePoints(250), { fetchFn: asFetch(fetchFn), signal: ac.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
