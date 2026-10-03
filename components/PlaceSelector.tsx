'use client';

import { useState } from 'react';
import { useLocale } from './LocaleProvider';
import { usePlace } from './PlaceProvider';
import { placeName } from '@/lib/places';
import { paaetInstitutions, subPlacesFor, subPlaceName, kuCollegeId, kuParkingSide, kuParkingScope, kuParkingSides } from '@/lib/sub-places';

const selectClass = 'h-[52px] w-full min-w-0 rounded-xl border border-white/15 bg-navy-950 px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300';

const labelClass = 'grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 text-xs font-medium';

// Only the pending parent is local UI state. The validated leaf scope remains in
// PlaceProvider so publishing, discovery and persistence share one source of truth.
function PaaetSelection() {
  const { locale, t } = useLocale();
  const { subPlaceId, selectSubPlace } = usePlace();
  const [pendingInstitution, setPendingInstitution] = useState<string | null>(null);
  const selectedInstitution = paaetInstitutions.find(item => item.campuses.some(campus => campus.id === subPlaceId));
  const institution = paaetInstitutions.find(item => item.id === (pendingInstitution ?? selectedInstitution?.id));
  return (
    <div className="grid min-w-0 gap-3">
      <label className={labelClass}>
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
        <label className={labelClass}>
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
  const collegeId = isKU ? kuCollegeId(subPlaceId) : null;
  const parkingSide = isKU ? kuParkingSide(subPlaceId) : null;
  const selectedSubPlace = subPlaces.find(item => item.id === (isKU ? collegeId : subPlaceId));
  const selectedSide = isKU ? kuParkingSides.find(item => item.id === parkingSide) : null;
  const summary = place ? [placeName(place, locale), selectedSubPlace && subPlaceName(selectedSubPlace, locale), selectedSide && subPlaceName(selectedSide, locale)].filter(Boolean).join(' · ') : '';
  return (
    <section id="place-selector" tabIndex={-1} className="glass-card mb-4 space-y-3 border-cyan-400/20 p-3" dir={dir} aria-label={t('place.title')}>
      <h2 className="text-sm font-bold text-white">{t('place.title')}</h2>
      {loading ? <p className="text-sm text-white/60" role="status">{t('common.loading')}</p> : error ? (
        <button className="btn min-h-11 w-full bg-white/10 text-white" type="button" onClick={retry}>{t('place.loadError')}</button>
      ) : (
        <label className={labelClass}>
          <span>{t('subPlace.institution')}</span>
          <select className={selectClass} value={place?.id ?? ''} onChange={event => selectPlace(event.target.value || null)}>
            <option value="">{t('subPlace.choose')}</option>
            {places.map(item => <option key={item.id} value={item.id}>{placeName(item, locale)}</option>)}
          </select>
        </label>
      )}
      {isKU && (
        <label className={labelClass}>
          <span>{t('subPlace.kuTitle')}</span>
          <select className={selectClass} value={selectedSubPlace?.id ?? ''} onChange={event => selectSubPlace(kuParkingScope(event.target.value || null, parkingSide))}>
            <option value="">{t('subPlace.choose')}</option>
            {subPlaces.map(item => <option key={item.id} value={item.id}>{subPlaceName(item, locale)}</option>)}
          </select>
        </label>
      )}
      {isKU && selectedSubPlace && (
        <label className={labelClass}>
          <span>{t('subPlace.kuParkingTitle')}</span>
          <select className={selectClass} value={parkingSide ?? ''} onChange={event => selectSubPlace(kuParkingScope(collegeId, event.target.value || null))}>
            <option value="">{t('subPlace.choose')}</option>
            {kuParkingSides.map(item => <option key={item.id} value={item.id}>{subPlaceName(item, locale)}</option>)}
          </select>
        </label>
      )}
      {place?.id === 'paaet' && <PaaetSelection key={place.id} />}
      <div className="min-w-0 rounded-lg bg-cyan-400/10 px-3 py-2 text-xs" aria-live="polite">
        {summary ? <p className="truncate font-medium text-cyan-200" title={summary}>{summary}</p> : <p className="truncate text-white/60" title={t('place.helper')}>{t('place.helper')}</p>}
      </div>
    </section>
  );
}
