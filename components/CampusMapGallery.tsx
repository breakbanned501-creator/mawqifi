'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Maximize2 } from 'lucide-react';
import MapLightbox from './MapLightbox';
import { useLocale } from '@/components/LocaleProvider';

const maps = [
  {
    src: '/map1.png',
    altKey: 'map.gatesAlt',
    captionKey: 'map.gatesCaption',
  },
  {
    src: '/map2.png',
    altKey: 'map.zonesAlt',
    captionKey: 'map.zonesCaption',
  },
] as const;

export default function CampusMapGallery() {
  const { t } = useLocale();
  const [activeMap, setActiveMap] = useState<(typeof maps)[number] | null>(null);

  return (
    <>
      <section className="mb-5" aria-label={t('map.galleryLabel')}>
        <p className="mb-3 text-sm font-bold text-white/55">{t('map.galleryHint')}</p>
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          {maps.map((map) => {
            const alt = t(map.altKey);
            const caption = t(map.captionKey);

            return (
              <figure key={map.src} className="m-0">
                <button
                  type="button"
                  onClick={() => setActiveMap(map)}
                  className="glass-card group w-full overflow-hidden p-2 text-start shadow-glow ring-1 ring-cyan-400/15 transition-all hover:ring-cyan-400/35 active:scale-[0.99]"
                  aria-label={t('map.zoomMap', { caption })}
                >
                  <div className="relative overflow-hidden rounded-2xl bg-navy-950/60 shadow-[0_0_24px_rgba(0,212,255,0.12)]">
                    <Image
                      src={map.src}
                      alt={alt}
                      width={640}
                      height={480}
                      className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      sizes="(max-width: 448px) 100vw, 220px"
                      priority={map.src === '/map1.png'}
                    />
                    <span className="absolute bottom-2 end-2 flex items-center gap-1 rounded-full bg-navy-950/80 px-2.5 py-1 text-[10px] font-bold text-cyan-200 backdrop-blur-sm">
                      <Maximize2 className="h-3.5 w-3.5" />
                      {t('map.zoomIn')}
                    </span>
                  </div>
                  <figcaption className="mt-2 px-1 text-center text-xs font-bold text-cyan-200/80">
                    {caption}
                  </figcaption>
                </button>
              </figure>
            );
          })}
        </div>
      </section>

      {activeMap && (
        <MapLightbox
          src={activeMap.src}
          alt={t(activeMap.altKey)}
          caption={t(activeMap.captionKey)}
          open={Boolean(activeMap)}
          onClose={() => setActiveMap(null)}
        />
      )}
    </>
  );
}
