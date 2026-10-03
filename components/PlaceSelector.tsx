'use client';

import { useState } from 'react';
import { useLocale } from './LocaleProvider';
import { usePlace } from './PlaceProvider';
import { placeName } from '@/lib/places';
import { paaetInstitutions, subPlacesFor, subPlaceName } from '@/lib/sub-places';

const selectClass = 'min-h-12 w-full min-w-0 rounded-xl border border-white/15 bg-navy-950 px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300';

// Only the pending parent is local UI state. The validated leaf scope remains in
// PlaceProvider so publishing, discovery and persistence share one source of truth.
function PaaetSelection() {
  const { locale, t } = useLocale();
  const { subPlaceId, selectSubPlace } = usePlace();
  const [pendingInstitution, setPendingInstitution] = useState<string | null>(null);
  const selectedInstitution = paaetInstitutions.find(item => item.campuses.some(campus => campus.id === subPlaceId));
  const institution = paaetInstitutions.find(item => item.id === (pendingInstitution ?? selectedInstitution?.id));
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <label className="min-w-0 space-y-1 text-sm font-semibold">
        <span>{t('subPlace.entity')}</span>
        <select aria-label={t('subPlace.paaetTitle')} className={selectClass} value={institution?.id ?? ''}
          onChange={event => {
            const next = paaetInstitutions.find(item => item.id === event.target.value);
            setPendingInstitution(next?.id ?? null);
            selectSubPlace(next?.campuses.length === 1 ? next.campuses[0].id : null);
          }}>
          <option value="">{t('subPlace.choose')}</option>
          {paaetInstitutions.map(item => <option key={item.id} value={item.id}>{subPlaceName(item, locale)}</option>)}
        </select>
      </label>
      {institution && institution.campuses.length > 1 && (
        <label className="min-w-0 space-y-1 text-sm font-semibold">
          <span>{t('subPlace.campus')}</span>
          <select className={selectClass} value={institution.campuses.some(item => item.id === subPlaceId) ? subPlaceId ?? '' : ''}
            onChange={event => selectSubPlace(event.target.value || null)}>
            <option value="">{t('subPlace.choose')}</option>
            {institution.campuses.map(item => <option key={item.id} value={item.id}>{subPlaceName(item, locale)}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

export default function PlaceSelector() {
  const { locale, dir, t } = useLocale();
  const { places, place, loading, error, selectPlace, retry, subPlaceId, selectSubPlace } = usePlace();
  const isKU = place?.id === 'kuwait_university';
  const subPlaces = subPlacesFor(place?.id ?? null);
  const selectedSubPlace = subPlaces.find(item => item.id === subPlaceId);
  const summary = place ? [placeName(place, locale), selectedSubPlace && subPlaceName(selectedSubPlace, locale)].filter(Boolean).join(' · ') : '';
  return (
    <section id="place-selector" tabIndex={-1} className="glass-card mb-4 space-y-3 border-cyan-400/20 p-4" dir={dir} aria-label={t('place.title')}>
      <h2 className="text-base font-extrabold text-white">{t('place.title')}</h2>
      {loading ? <p className="text-sm text-white/60" role="status">{t('common.loading')}</p> : error ? (
        <button className="btn min-h-11 w-full bg-white/10 text-white" type="button" onClick={retry}>{t('place.loadError')}</button>
      ) : (
        <label className="block space-y-1 text-sm font-semibold">
          <span>{t('subPlace.institution')}</span>
          <select className={selectClass} value={place?.id ?? ''} onChange={event => selectPlace(event.target.value || null)}>
            <option value="">{t('subPlace.choose')}</option>
            {places.map(item => <option key={item.id} value={item.id}>{placeName(item, locale)}</option>)}
          </select>
        </label>
      )}
      {isKU && (
        <label className="block space-y-1 text-sm font-semibold">
          <span>{t('subPlace.kuTitle')}</span>
          <select className={selectClass} value={selectedSubPlace?.id ?? ''} onChange={event => selectSubPlace(event.target.value || null)}>
            <option value="">{t('subPlace.choose')}</option>
            {subPlaces.map(item => <option key={item.id} value={item.id}>{subPlaceName(item, locale)}</option>)}
          </select>
        </label>
      )}
      {place?.id === 'paaet' && <PaaetSelection key={place.id} />}
      <div className="rounded-xl bg-white/5 px-3 py-2 text-sm" aria-live="polite">
        {summary ? <p className="break-words font-semibold text-cyan-200">{summary}</p> : <p className="text-white/60">{t('place.helper')}</p>}
        {isKU && selectedSubPlace && <p className="mt-1 text-xs text-white/60">{t('subPlace.parkingArea')}: {t('subPlace.general')}</p>}
        {place && !selectedSubPlace && place.id !== 'gust' && <p className="mt-1 text-xs text-white/60">{t(isKU ? 'subPlace.kuHelper' : 'subPlace.paaetHelper')}</p>}
      </div>
    </section>
  );
}
