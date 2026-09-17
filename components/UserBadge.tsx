'use client';

import { Award } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { TOP_PARKING_CONTRIBUTOR_BADGE, type BadgeKey } from '@/lib/badges';

interface UserBadgeProps {
  badges: readonly BadgeKey[];
}

/** A compact, localized rendering of trusted recognition rows. */
export default function UserBadge({ badges }: UserBadgeProps) {
  const { t } = useLocale();

  if (!badges.includes(TOP_PARKING_CONTRIBUTOR_BADGE)) return null;

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-cyan-300/20 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] font-bold leading-4 text-cyan-100 sm:px-2 sm:text-[11px]"
      title={t('badges.topParkingContributor')}
    >
      <Award className="h-3 w-3 shrink-0" aria-hidden="true" />
      {t('badges.topParkingContributor')}
    </span>
  );
}
