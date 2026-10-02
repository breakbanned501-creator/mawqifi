'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import { isNativeCapacitor } from '@/lib/capacitor';
import { openOfficialMapUrl } from '@/lib/official-map-links';
import { useLocale } from './LocaleProvider';
import { usePlace } from './PlaceProvider';
import CampusMapGallery from './CampusMapGallery';
import OfficialMapCard from './OfficialMapCard';
import { gustAccessibleMap, gustMapSource, kuMapSource, paaetCampuses, paaetMapSource } from '@/lib/location-map-sources';

export default function PlaceGuidance() {
  const { place } = usePlace();
  const { locale, dir, t } = useLocale();
  const [campusId, setCampusId] = useState('');
  const [openError, setOpenError] = useState(false);
  useEffect(() => { setCampusId(''); setOpenError(false); }, [place?.id]);
  const openSource = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isNativeCapacitor()) return;
    event.preventDefault();
    setOpenError(false);
    void openOfficialMapUrl(event.currentTarget.href).catch(() => { setOpenError(true); });
  };
  if (!place) return null;
  const campus = paaetCampuses.find(item => item.id === campusId);
  const source = place.id === 'kuwait_university' ? kuMapSource : place.id === 'gust' ? gustMapSource : place.id === 'paaet' ? paaetMapSource : null;
  return (
    <section className="glass-card space-y-3 p-4 sm:p-5" dir={dir} aria-label={t('place.guidance')}>
      <h2 className="text-base font-extrabold text-white">{t('place.guidance')}</h2>
      <p className="text-sm leading-6 text-white/60">{t('place.mapHint')}</p>
      {place.id === 'kuwait_university' ? <CampusMapGallery /> : !source && (
        <p className="rounded-2xl bg-white/5 p-3 text-sm leading-6 text-white/70">{t('place.noMap')}</p>
      )}
      {place.id === 'paaet' && (
        <div className="space-y-2">
          <p className="text-sm leading-6 text-white/70">{t('place.paaetHint')}</p>
          <label htmlFor="guidance-campus" className="block text-sm font-bold text-white/80">{t('place.campusGuidance')}</label>
          <select id="guidance-campus" className="input min-h-12" value={campusId} onChange={event => setCampusId(event.target.value)}>
            <option value="">{t('place.chooseCampus')}</option>
            {paaetCampuses.map(item => <option key={item.id} value={item.id}>{locale === 'ar' ? item.name_ar : item.name_en}</option>)}
          </select>
          <OfficialMapCard key={campusId || 'directory'}
            title={campus ? (locale === 'ar' ? campus.name_ar : campus.name_en) : t('place.paaetDirectoryTitle')}
            description={t(campus ? 'place.paaetDirectionsHint' : 'place.paaetDirectoryHint')}
            href={campus?.url ?? paaetMapSource} sourceUrl={paaetMapSource}
            kind={campus ? 'directions' : 'directory'} />
        </div>
      )}
      {place.id === 'gust' && (
        <div className="space-y-3">
          <OfficialMapCard title={t('place.gustCampusTitle')} description={t('place.gustCampusHint')}
            href={gustMapSource} sourceUrl={gustMapSource} kind="campus" />
          <OfficialMapCard title={t('place.gustAccessibleTitle')} description={t('place.gustAccessibleHint')}
            href={gustAccessibleMap} sourceUrl={gustMapSource} kind="pdf" />
        </div>
      )}
      {place.id === 'kuwait_university' && source && <a href={source} onClick={openSource} target="_blank" rel="noopener noreferrer" className="block min-h-11 py-2 text-sm font-bold text-cyan-200 underline">{t('place.officialSource')}</a>}
      {openError && <p role="alert" className="text-sm text-red-200">{t('common.error')}</p>}
      <p className="text-xs leading-5 text-white/45">{t('place.attribution')}</p>
    </section>
  );
}
