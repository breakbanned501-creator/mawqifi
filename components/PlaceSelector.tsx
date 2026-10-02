'use client';

import { useLocale } from './LocaleProvider';
import { usePlace } from './PlaceProvider';
import { placeName } from '@/lib/places';

export default function PlaceSelector() {
  const { locale, dir, t } = useLocale();
  const { places, place, loading, error, selectPlace, retry } = usePlace();
  return (
    <section id="place-selector" tabIndex={-1} className="glass-card mb-5 space-y-3 border-cyan-400/20 p-4 sm:p-5" dir={dir} aria-label={t('place.title')}>
      <div>
        <h2 className="text-lg font-extrabold text-white">{t('place.title')}</h2>
        <p className="mt-1 text-sm leading-6 text-white/60">{t('place.helper')}</p>
      </div>
      {loading ? <p className="text-sm text-white/60" role="status">{t('common.loading')}</p> : error ? (
        <button className="btn min-h-11 w-full bg-white/10 text-white" type="button" onClick={retry}>{t('place.loadError')}</button>
      ) : (
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-3" role="group" aria-label={t('place.title')}>
          {places.map(item => (
            <button key={item.id} type="button" aria-pressed={place?.id === item.id}
              onClick={() => selectPlace(item.id)}
              className={['min-h-12 rounded-2xl border px-3 py-3 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300',
                place?.id === item.id ? 'border-cyan-400 bg-cyan-400 text-navy-950' : 'border-white/10 bg-white/5 text-white/80 hover:border-cyan-400/40'].join(' ')}>
              {placeName(item, locale)}
            </button>
          ))}
        </div>
      )}
      {place && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="font-bold text-cyan-200" aria-live="polite">{t('place.selected', { place: placeName(place, locale) })}</p>
          <button className="min-h-11 rounded-xl px-3 text-white/60 underline" type="button" onClick={() => selectPlace(null)}>{t('place.clear')}</button>
        </div>
      )}
    </section>
  );
}
