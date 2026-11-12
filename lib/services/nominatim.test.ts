import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSearchUrl,
  createPlaceSearcher,
  parseBoundingBox,
  parseResults,
  searchErrorMessage,
} from "./nominatim";
import { isAbortError } from "./abort";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("buildSearchUrl", () => {
  it("encodes spaces and ampersands", () => {
    const url = new URL(buildSearchUrl("Tom & Jerry st"));
    expect(url.searchParams.get("q")).toBe("Tom & Jerry st");
    expect(url.search).not.toContain("Tom & Jerry");
    expect(url.search).toContain("%26");
    expect(url.searchParams.get("format")).toBe("jsonv2");
    expect(url.searchParams.get("limit")).toBe("5");
  });

  it("encodes non-Latin text", () => {
    const url = buildSearchUrl("काठमाडौँ");
    expect(url).toContain("%E0%A4%95");
    expect(new URL(url).searchParams.get("q")).toBe("काठमाडौँ");
  });

  it("adds accept-language only when given", () => {
    expect(buildSearchUrl("x")).not.toContain("accept-language");
    expect(buildSearchUrl("x", "en-GB")).toContain("accept-language=en-GB");
  });
});

describe("parseBoundingBox", () => {
  it("converts [s, n, w, e] strings to [[s, w], [n, e]] numbers", () => {
    expect(parseBoundingBox(["27.6", "27.8", "85.2", "85.5"])).toEqual([
      [27.6, 85.2],
      [27.8, 85.5],
    ]);
  });

  it("returns null for missing, malformed or degenerate boxes", () => {
    expect(parseBoundingBox(undefined)).toBeNull();
    expect(parseBoundingBox(["1", "2", "3"])).toBeNull();
    expect(parseBoundingBox(["a", "2", "3", "4"])).toBeNull();
    expect(parseBoundingBox(["1", "1", "3", "4"])).toBeNull();
    expect(parseBoundingBox(["1", "2", "3", "3"])).toBeNull();
    expect(parseBoundingBox(["2", "1", "3", "4"])).toBeNull();
  });
});

describe("parseResults", () => {
  it("parses valid items and drops malformed ones", () => {
    const results = parseResults([
      {
        place_id: 1,
        display_name: "Kathmandu",
        lat: "27.7",
        lon: "85.3",
        boundingbox: ["27.6", "27.8", "85.2", "85.5"],
      },
      { display_name: "No coords" },
      { display_name: "Bad lat", lat: "abc", lon: "1" },
      { display_name: "Out of range", lat: "91", lon: "1" },
      { lat: "1", lon: "1" },
      null,
      "str",
      { place_id: 2, display_name: "Pt", lat: "1.5", lon: "2.5" },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      id: "1",
      displayName: "Kathmandu",
      lat: 27.7,
      lng: 85.3,
      bounds: [
        [27.6, 85.2],
        [27.8, 85.5],
      ],
    });
    expect(results[1].bounds).toBeNull();
  });

  it("returns an empty list for an empty array", () => {
    expect(parseResults([])).toEqual([]);
  });

  it("throws when the body is not an array", () => {
    expect(() => parseResults({ error: "x" })).toThrow();
  });
});

describe("createPlaceSearcher", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const item = { place_id: 1, display_name: "A", lat: "1", lon: "2" };

  it("ignores empty queries without fetching", async () => {
    const fetchFn = vi.fn();
    const search = createPlaceSearcher({ fetchFn });
    expect(await search("   ")).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("sends the second of two quick calls only after 1 s", async () => {
    const fetchFn = vi.fn(async () => jsonResponse([item]));
    const search = createPlaceSearcher({ fetchFn });

    await search("one");
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const second = search("two");
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await second).toHaveLength(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("does not wait when 1 s has already passed", async () => {
    const fetchFn = vi.fn(async () => jsonResponse([item]));
    const search = createPlaceSearcher({ fetchFn });
    await search("one");
    await vi.advanceTimersByTimeAsync(1000);
    await search("two");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("aborts a waiting search when a new one starts", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse([item]),
    );
    const search = createPlaceSearcher({ fetchFn: fetchFn as unknown as typeof fetch });
    await search("one");

    const secondResult = search("two").catch((e) => e);
    const third = search("three");
    await vi.advanceTimersByTimeAsync(1000);

    expect(isAbortError(await secondResult)).toBe(true);
    await third;
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(String((fetchFn.mock.calls as unknown[][])[1][0])).toContain("three");
  });

  it("aborts the in-flight request when a new search starts", async () => {
    let firstSignal: AbortSignal | undefined;
    const fetchFn = vi.fn((_url: unknown, init?: RequestInit) => {
      if (!firstSignal) {
        firstSignal = init?.signal ?? undefined;
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const e = new Error("aborted");
            e.name = "AbortError";
            reject(e);
          });
        });
      }
      return Promise.resolve(jsonResponse([item]));
    }) as unknown as typeof fetch;
    const search = createPlaceSearcher({ fetchFn });

    const first = search("one").catch((e) => e);
    await vi.advanceTimersByTimeAsync(0);
    const second = search("two");
    await vi.advanceTimersByTimeAsync(1000);

    expect(firstSignal?.aborted).toBe(true);
    expect(isAbortError(await first)).toBe(true);
    expect(await second).toHaveLength(1);
  });

  it("rejects on HTTP 500", async () => {
    const search = createPlaceSearcher({
      fetchFn: vi.fn(async () => new Response("err", { status: 500 })),
    });
    await expect(search("x")).rejects.toThrow(/500/);
  });

  it("rejects on malformed JSON", async () => {
    const search = createPlaceSearcher({
      fetchFn: vi.fn(async () => new Response("{not json", { status: 200 })),
    });
    await expect(search("x")).rejects.toThrow(/invalid/i);
  });

  it("does not freeze when the clock jumps backwards", async () => {
    let t = 10_000;
    const fetchFn = vi.fn(async () => jsonResponse([item]));
    const search = createPlaceSearcher({ fetchFn, now: () => t });
    await search("one");
    t = 0; // clock jumps back
    const second = search("two");
    await vi.advanceTimersByTimeAsync(1000);
    expect(await second).toHaveLength(1);
  });

  it("rejects on a network error", async () => {
    const search = createPlaceSearcher({
      fetchFn: vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    });
    await expect(search("x")).rejects.toThrow();
  });
});

describe("searchErrorMessage", () => {
  it("distinguishes network failures from service errors", () => {
    expect(searchErrorMessage(new TypeError("Failed to fetch"))).toBe(
      "Search failed — check your connection.",
    );
    expect(searchErrorMessage(new Error("Search failed (HTTP 500)"))).toBe(
      "Search service unavailable, try again later.",
    );
    expect(searchErrorMessage(new Error("Search returned an invalid response"))).toBe(
      "Search service unavailable, try again later.",
    );
  });
});
