import { abortError, isAbortError } from "./abort";

export type LatLngTuple = [number, number];
/** [[south, west], [north, east]] */
export type LatLngBoundsTuple = [LatLngTuple, LatLngTuple];

export type PlaceResult = {
  id: string;
  displayName: string;
  lat: number;
  lng: number;
  /** Null when the bounding box is missing or degenerate. */
  bounds: LatLngBoundsTuple | null;
};

export const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
export const RESULT_LIMIT = 5;
export const MIN_INTERVAL_MS = 1000;

export function buildSearchUrl(query: string, acceptLanguage?: string): string {
  const params = new URLSearchParams({
    format: "jsonv2",
    q: query,
    limit: String(RESULT_LIMIT),
  });
  if (acceptLanguage) params.set("accept-language", acceptLanguage);
  return `${NOMINATIM_SEARCH_URL}?${params.toString()}`;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Nominatim gives boundingbox as [south, north, west, east] strings.
 * Returns [[south, west], [north, east]], or null if invalid or degenerate.
 */
export function parseBoundingBox(raw: unknown): LatLngBoundsTuple | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const [south, north, west, east] = raw.map(toNumber);
  if (
    south === null ||
    north === null ||
    west === null ||
    east === null ||
    south < -90 ||
    north > 90 ||
    west < -180 ||
    east > 180 ||
    south >= north ||
    west >= east
  ) {
    return null;
  }
  return [
    [south, west],
    [north, east],
  ];
}

/** Validates a Nominatim JSON body. Throws if it is not an array; drops malformed items. */
export function parseResults(json: unknown): PlaceResult[] {
  if (!Array.isArray(json)) throw new Error("Unexpected response from search");
  const results: PlaceResult[] = [];
  json.forEach((item: unknown, index) => {
    if (typeof item !== "object" || item === null) return;
    const rec = item as Record<string, unknown>;
    const lat = toNumber(rec.lat);
    const lng = toNumber(rec.lon);
    if (
      typeof rec.display_name !== "string" ||
      rec.display_name.trim() === "" ||
      lat === null ||
      lng === null ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      return;
    }
    const id =
      typeof rec.place_id === "number" || typeof rec.place_id === "string"
        ? String(rec.place_id)
        : `idx-${index}`;
    results.push({
      id,
      displayName: rec.display_name,
      lat,
      lng,
      bounds: parseBoundingBox(rec.boundingbox),
    });
  });
  return results.slice(0, RESULT_LIMIT);
}

/** Friendly text for a failed search: network failures versus service errors. */
export function searchErrorMessage(err: unknown): string {
  return err instanceof TypeError
    ? "Search failed — check your connection."
    : "Search service unavailable, try again later.";
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(abortError());
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

type SearcherOptions = {
  fetchFn?: typeof fetch;
  now?: () => number;
  minIntervalMs?: number;
};

/**
 * Creates a searcher that sends at most one request per `minIntervalMs`
 * (a search made too soon waits) and aborts the previous search when a new
 * one starts. The aborted search rejects with an AbortError.
 */
export function createPlaceSearcher(options: SearcherOptions = {}) {
  const minInterval = options.minIntervalMs ?? MIN_INTERVAL_MS;
  const now = options.now ?? (() => performance.now());
  // performance.now() is monotonic, so a clock change cannot freeze the throttle.
  let lastSentAt: number | null = null;
  let controller: AbortController | null = null;

  return async function search(
    query: string,
    acceptLanguage?: string,
  ): Promise<PlaceResult[]> {
    const q = query.trim();
    if (q === "") return [];

    controller?.abort();
    const own = new AbortController();
    controller = own;

    const waitMs =
      lastSentAt === null
        ? 0
        : Math.min(minInterval, Math.max(0, lastSentAt + minInterval - now()));
    if (waitMs > 0) await wait(waitMs, own.signal);
    if (own.signal.aborted) throw abortError();

    lastSentAt = now();
    const doFetch = options.fetchFn ?? fetch;
    const res = await doFetch(buildSearchUrl(q, acceptLanguage), {
      signal: own.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Search failed (HTTP ${res.status})`);
    let json: unknown;
    try {
      json = await res.json();
    } catch (err) {
      if (isAbortError(err)) throw err;
      throw new Error("Search returned an invalid response");
    }
    if (own.signal.aborted) throw abortError();
    return parseResults(json);
  };
}
