import { buildSummary, type ChainageSummary } from "../chainage/summary";
import type { ChainagePoint, LatLng } from "../chainage/types";
import { sanitizeFileName } from "../pdf/filename";

export type ElevationStatus = "ok" | "partial" | "failed";

export type MapImageStatus = "ok" | "unavailable";
export type MapImage = { dataUrl: string; width: number; height: number };

export type ExportResult = {
  fileName: string;
  elevationStatus: ElevationStatus;
  mapImageStatus: MapImageStatus;
};

export type ExportInput = {
  name: string;
  points: ChainagePoint[];
  vertices: LatLng[];
  interval: number;
  signal?: AbortSignal;
};

type PdfInput = {
  projectName: string;
  generatedAt: Date;
  summary: ChainageSummary;
  points: ChainagePoint[];
  mapImage: MapImage | null;
  elevationUsed: boolean;
};

export type ExportDeps<Doc> = {
  fetchElevations: (
    points: { lat: number; lng: number }[],
    opts: { signal?: AbortSignal },
  ) => Promise<{ elevations: (number | null)[]; anyFailed: boolean }>;
  /** Loads the PDF builder lazily so jsPDF stays out of the initial bundle. */
  loadBuildPdf: () => Promise<(input: PdfInput) => Doc>;
  save: (doc: Doc, fileName: string) => void;
  now: () => Date;
  /** Captures the map snapshot; null when unavailable. */
  captureMap: (
    vertices: LatLng[],
    points: ChainagePoint[],
    opts: { signal?: AbortSignal },
  ) => Promise<MapImage | null>;
};

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

/**
 * Fetches elevations, builds the PDF and saves it.
 *
 * Decision: an elevation fetch that rejects with anything other than an
 * AbortError is treated as "all elevations failed" (status 'failed'); the PDF
 * is still exported with dashes. An AbortError is rethrown so callers can stop.
 * captureMap follows the same rule: a non-abort failure means no map image.
 * Errors from building or saving the PDF propagate.
 */
export async function runExport<Doc>(
  input: ExportInput,
  deps: ExportDeps<Doc>,
): Promise<ExportResult> {
  // Snapshot so later edits cannot affect this export.
  const name = input.name.trim();
  const base = input.points.map((p) => ({ ...p }));
  const vertices = input.vertices.map((v) => ({ ...v }));
  const interval = input.interval;

  let elevations: (number | null)[] = base.map(() => null);
  try {
    const res = await deps.fetchElevations(
      base.map((p) => ({ lat: p.lat, lng: p.lng })),
      { signal: input.signal },
    );
    elevations = base.map((_, i) => res.elevations[i] ?? null);
  } catch (err) {
    if (isAbortError(err)) throw err;
  }

  const points = base.map((p, i) => ({ ...p, elevation: elevations[i] }));
  const usedCount = elevations.filter((e) => e !== null).length;
  const elevationStatus: ElevationStatus =
    usedCount === 0 && points.length > 0
      ? "failed"
      : usedCount < points.length
        ? "partial"
        : "ok";

  let mapImage: MapImage | null = null;
  try {
    mapImage = await deps.captureMap(vertices, points, { signal: input.signal });
  } catch (err) {
    if (isAbortError(err)) throw err;
  }

  const generatedAt = deps.now();
  const buildPdf = await deps.loadBuildPdf();
  const doc = buildPdf({
    projectName: name,
    generatedAt,
    summary: buildSummary(points, vertices, interval),
    points,
    mapImage,
    elevationUsed: usedCount > 0,
  });
  const fileName = sanitizeFileName(name);
  deps.save(doc, fileName);
  return {
    fileName,
    elevationStatus,
    mapImageStatus: mapImage ? "ok" : "unavailable",
  };
}
