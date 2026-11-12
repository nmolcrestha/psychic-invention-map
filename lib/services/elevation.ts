import { abortError } from "./abort";

export type ElevationPoint = { lat: number; lng: number };

export type ElevationResult = {
  elevations: (number | null)[];
  /** True if any point has a null elevation. */
  anyFailed: boolean;
};

export type FetchElevationsOptions = {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  batchSize?: number;
  /** Aborting this rejects the whole call with an AbortError (no partial result). */
  signal?: AbortSignal;
};

export const ELEVATION_URL = "https://api.open-meteo.com/v1/elevation";
export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_BATCH_SIZE = 100;

function round6(n: number): string {
  return String(Number(n.toFixed(6)));
}

export function buildElevationUrl(points: ElevationPoint[]): string {
  const lat = points.map((p) => round6(p.lat)).join(",");
  const lng = points.map((p) => round6(p.lng)).join(",");
  return `${ELEVATION_URL}?latitude=${lat}&longitude=${lng}`;
}

/**
 * Fetches one batch. Returns null when the whole batch failed (network error,
 * non-2xx, timeout, malformed JSON, missing or wrong-length `elevation` array).
 *
 * Choice: if the array length is right, a non-finite or non-number entry
 * becomes null for that point only, so one bad value does not discard the
 * other points in the batch.
 */
async function fetchBatch(
  points: ElevationPoint[],
  fetchFn: typeof fetch,
  timeoutMs: number,
  external: AbortSignal | undefined,
): Promise<(number | null)[] | null> {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  external?.addEventListener("abort", onExternalAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(buildElevationUrl(points), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const values =
      typeof json === "object" && json !== null
        ? (json as { elevation?: unknown }).elevation
        : undefined;
    if (!Array.isArray(values) || values.length !== points.length) return null;
    return values.map((v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? v : null,
    );
  } catch {
    // Timeout, network error, malformed JSON. A user abort is detected by the caller.
    return null;
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", onExternalAbort);
  }
}

/**
 * Fetches elevations from Open-Meteo in sequential batches. Failed batches give
 * null for their points; other batches still run. Output order matches input.
 */
export async function fetchElevations(
  points: ElevationPoint[],
  opts: FetchElevationsOptions = {},
): Promise<ElevationResult> {
  const {
    fetchFn = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    batchSize = DEFAULT_BATCH_SIZE,
    signal,
  } = opts;

  if (signal?.aborted) throw abortError();
  if (points.length === 0) return { elevations: [], anyFailed: false };

  const size = Number.isFinite(batchSize)
    ? Math.min(DEFAULT_BATCH_SIZE, Math.max(1, Math.floor(batchSize)))
    : DEFAULT_BATCH_SIZE;
  const elevations: (number | null)[] = [];
  for (let i = 0; i < points.length; i += size) {
    const batch = points.slice(i, i + size);
    const result = await fetchBatch(batch, fetchFn, timeoutMs, signal);
    if (signal?.aborted) throw abortError();
    if (result) elevations.push(...result);
    else elevations.push(...batch.map(() => null));
  }
  return { elevations, anyFailed: elevations.some((e) => e === null) };
}
