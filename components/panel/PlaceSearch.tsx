"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  createPlaceSearcher,
  isAbortError,
  type PlaceResult,
} from "@/lib/services/nominatim";

type PlaceSearchProps = {
  onPick: (place: PlaceResult) => void;
};

type Status = "idle" | "loading" | "done" | "error";

const BUTTON =
  "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

export default function PlaceSearch({ onPick }: PlaceSearchProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [error, setError] = useState("");
  const searcher = useRef<ReturnType<typeof createPlaceSearcher> | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    // Invalidate any pending search on unmount.
    return () => {
      requestId.current += 1;
    };
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = query.trim();
    if (q === "") return;
    searcher.current ??= createPlaceSearcher();
    const id = ++requestId.current;
    setStatus("loading");
    setError("");
    try {
      const language =
        typeof navigator !== "undefined" ? navigator.language : undefined;
      const found = await searcher.current(q, language);
      if (id !== requestId.current) return;
      setResults(found);
      setStatus("done");
    } catch (err) {
      if (isAbortError(err) || id !== requestId.current) return;
      setResults([]);
      setError(
        err instanceof Error && err.message
          ? `Search failed: ${err.message}`
          : "Search failed. Check your connection and try again.",
      );
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label
          htmlFor={inputId}
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          Search for a place
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
          />
          <button
            type="submit"
            className={BUTTON}
            disabled={query.trim() === ""}
          >
            Search
          </button>
        </div>
      </form>
      <div
        aria-live="polite"
        className="text-sm text-zinc-500 dark:text-zinc-400"
      >
        {status === "loading" && <p>Searching...</p>}
        {status === "error" && (
          <p className="text-red-600 dark:text-red-400">{error}</p>
        )}
        {status === "done" && results.length === 0 && <p>No results</p>}
      </div>
      {status === "done" && results.length > 0 && (
        <ul className="flex flex-col gap-1">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onPick(r)}
                className="w-full rounded-md border border-zinc-200 px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800"
              >
                {r.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
