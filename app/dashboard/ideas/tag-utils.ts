// app/dashboard/ideas/tag-utils.ts
// Pure, client-safe helper that parses a comma-separated tag/role input into a
// de-duplicated list. Shared by the idea create + edit forms so the same parsing
// rule (comma-delimited, trimmed, capped) is unit-tested in one place.
//
// Server-side schemas (skillsSchema / idea tag arrays) are responsible for
// lower-casing and length caps; this helper only tokenises + dedupes.
export function parseTagList(input: string, max = 10): string[] {
  if (!input) return []
  const tags = input
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
  return Array.from(new Set(tags)).slice(0, max)
}

export function joinTagList(tags: readonly string[], separator = ', '): string {
  return tags.join(separator)
}
