export const TOP_PARKING_CONTRIBUTOR_BADGE = 'top_parking_contributor' as const;

export const badgeKeys = [TOP_PARKING_CONTRIBUTOR_BADGE] as const;

export type BadgeKey = (typeof badgeKeys)[number];

function isBadgeKey(value: unknown): value is BadgeKey {
  return typeof value === 'string' && badgeKeys.includes(value as BadgeKey);
}

/**
 * Keeps database recognition data isolated from UI concerns and ignores any
 * unexpected row returned by a future schema change.
 */
export function parseBadgeKeys(value: unknown): BadgeKey[] {
  const rows = Array.isArray(value) ? value : value ? [value] : [];
  const keys = rows.flatMap((row) => {
    if (!row || typeof row !== 'object' || !('badge_key' in row)) return [];
    return isBadgeKey(row.badge_key) ? [row.badge_key] : [];
  });

  return [...new Set(keys)];
}
