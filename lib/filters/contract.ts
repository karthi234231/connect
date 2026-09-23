// src/lib/filters/contract.ts
// S036 — Shared cross-domain filter/search contract primitives.
// URL is the source of truth for shareable discovery surfaces (events, discover,
// ideas). Domains keep their own option sets; only the parse/serialize/chip/
// result-shape infrastructure lives here. Rules:
//  - invalid input becomes the safe default, never an error thrown at the URL layer;
//  - serialization omits default values (same URL restores same result state);
//  - cursors are opaque strings passed through untouched.

import { z } from 'zod'

/** Read one param from either Next.js searchParams or URLSearchParams. */
export function readParam(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  if (params instanceof URLSearchParams) return params.get(key)
  const v = params[key]
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

/** Parse a single-value param against a value set; invalid/missing → default. */
export function parseEnumParam<T extends string>(
  raw: string | null,
  allowed: ReadonlySet<T>,
  fallback: T,
): T {
  return raw && (allowed as ReadonlySet<string>).has(raw)
    ? (raw as T)
    : fallback
}

/** Same as parseEnumParam but the fallback is "no value" (null). */
export function parseEnumParamNullable<T extends string>(
  raw: string | null,
  allowed: ReadonlySet<T>,
): T | null {
  return raw && (allowed as ReadonlySet<string>).has(raw) ? (raw as T) : null
}

/** Shared query-string DTO bounds for text search across domains. */
export const FILTER_QUERY_SCHEMA = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((v) => v ?? '')

/** Append only non-default values → stable, shareable, minimal URLs. */
export function appendIfSet(
  params: URLSearchParams,
  key: string,
  value: string | null | undefined,
): void {
  if (value !== null && value !== undefined && value !== '')
    params.set(key, value)
}

/** Append unless equal to the domain default (enum params use sentinel defaults). */
export function appendIfNotDefault(
  params: URLSearchParams,
  key: string,
  value: string,
  defaultValue: string,
): void {
  if (value !== defaultValue) params.set(key, value)
}

/** Canonical filter-state DTO every discovery domain returns to its UI. */
export interface FilteredResult<TItem> {
  items: TItem[]
  /** Opaque keyset cursor for the next page; null = end of results. */
  nextCursor: string | null
  /** Human-readable active filters (for the chips row). */
  appliedFilters: { key: string; label: string }[]
  /** Optional per-facet counts when the domain can compute them cheaply. */
  facetCounts?: Record<string, number>
  /** Estimated total matches (may be approximate); null when unknown. */
  totalEstimate?: number | null
}

/** Build a URL that clears one filter while preserving the rest. */
export function buildClearedUrl(
  basePath: string,
  current: URLSearchParams,
  keysToClear: readonly string[],
): string {
  const next = new URLSearchParams(current)
  for (const key of keysToClear) next.delete(key)
  const qs = next.toString()
  return qs ? `${basePath}?${qs}` : basePath
}
