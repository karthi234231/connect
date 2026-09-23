export function formatLocation(
  city?: string | null,
  region?: string | null,
  country?: string | null,
): string {
  return [city, region, country]
    .filter((part): part is string => !!part && part.trim().length > 0)
    .join(', ')
}
