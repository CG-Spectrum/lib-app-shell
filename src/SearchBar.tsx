"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { visibleResults, groupByApp } from "./searchbar-logic";
import type { SearchResult } from "./searchbar-logic";

export function SearchBar({ userApps }: { userApps: string[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dismiss on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const fetchResults = useCallback(
    async (q: string) => {
      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(false);

      try {
        const res = await fetch(
          `/api/shell-search?q=${encodeURIComponent(q)}`,
          { signal: controller.signal, credentials: "same-origin" },
        );
        if (!res.ok) {
          // 404 = endpoint not present on this app — render nothing gracefully
          setResults([]);
          setLoading(false);
          return;
        }
        const data: SearchResult[] = await res.json();
        setResults(data);
        setOpen(true);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setError(true);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.trim().length < 2) {
      abortRef.current?.abort();
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      void fetchResults(q.trim());
    }, 250);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      setResults([]);
    }
  }

  const filtered = visibleResults(results, userApps);
  const groups = groupByApp(filtered);
  const hasResults = filtered.length > 0;
  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="search"
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
        aria-label="Search mentors, courses, partners"
        placeholder="Search mentors, courses, partners…"
        value={query}
        onChange={handleChange}
        onFocus={() => { if (filtered.length > 0) setOpen(true); }}
        onKeyDown={handleKeyDown}
        className={[
          "w-64 min-w-0 shrink border px-3 py-1.5 text-sm",
          "bg-surface border-border text-text placeholder:text-text-3",
          "focus:outline-none focus:border-accent transition-colors",
        ].join(" ")}
      />

      {showDropdown && (
        <div
          role="listbox"
          aria-label="Search results"
          className={[
            "absolute left-0 top-full mt-1 z-50",
            "w-72 min-w-full border border-border-strong bg-surface",
            "overflow-y-auto max-h-80",
          ].join(" ")}
        >
          {loading && (
            <p className="px-3 py-2 text-xs text-text-3">Searching…</p>
          )}

          {!loading && !error && !hasResults && (
            <p className="px-3 py-2 text-xs text-text-3">No matches</p>
          )}

          {!loading && !error && hasResults && groups.map((group) => (
            <div key={group.app}>
              <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-3 select-none">
                {group.label}
              </p>
              {group.results.map((result, idx) => (
                <a
                  key={`${result.type}-${result.title}-${idx}`}
                  href={result.href}
                  role="option"
                  aria-selected={false}
                  className={[
                    "flex flex-col px-3 py-2 text-sm text-text",
                    "hover:bg-accent/10 focus:bg-accent/10 focus:outline-none",
                    "transition-colors",
                  ].join(" ")}
                  onClick={() => setOpen(false)}
                >
                  <span className="font-medium leading-tight">{result.title}</span>
                  {result.subtitle && (
                    <span className="text-xs text-text-3 leading-tight mt-0.5">{result.subtitle}</span>
                  )}
                </a>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
