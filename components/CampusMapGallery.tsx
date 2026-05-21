'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Maximize2 } from 'lucide-react';
import MapLightbox from './MapLightbox';

const maps = [
  {
    src: '/map1.png',
    alt: 'خريطة بوابات ومواقف الحرم الجامعي — جامعة الكويت',
    caption: 'بوابات الدخول والمواقف',
  },
  {
    src: '/map2.png',
    alt: 'خريطة المنطقة أ والمنطقة ب والكليات — جامعة الكويت',
    caption: 'المنطقة أ والمنطقة ب',
  },
] as const;

export default function CampusMapGallery() {
  const [activeMap, setActiveMap] = useState<(typeof maps)[number] | null>(null);

  return (
    <>
      <section className="mb-5" aria-label="خرائط إرشادية">
        <p className="mb-3 text-sm font-bold text-white/55">خرائط إرشادية للحرم — اضغط للتكبير</p>
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          {maps.map((map) => (
            <figure key={map.src} className="m-0">
              <button
                type="button"
                onClick={() => setActiveMap(map)}
                className="glass-card group w-full overflow-hidden p-2 text-start shadow-glow ring-1 ring-cyan-400/15 transition-all hover:ring-cyan-400/35 active:scale-[0.99]"
                aria-label={`تكبير ${map.caption}`}
              >
                <div className="relative overflow-hidden rounded-2xl bg-navy-950/60 shadow-[0_0_24px_rgba(0,212,255,0.12)]">
                  <Image
                    src={map.src}
                    alt={map.alt}
                    width={640}
                    height={480}
                    className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    sizes="(max-width: 448px) 100vw, 220px"
                    priority={map.src === '/map1.png'}
                  />
                  <span className="absolute bottom-2 end-2 flex items-center gap-1 rounded-full bg-navy-950/80 px-2.5 py-1 text-[10px] font-bold text-cyan-200 backdrop-blur-sm">
                    <Maximize2 className="h-3.5 w-3.5" />
                    تكبير
                  </span>
                </div>
                <figcaption className="mt-2 px-1 text-center text-xs font-bold text-cyan-200/80">
                  {map.caption}
                </figcaption>
              </button>
            </figure>
          ))}
        </div>
      </section>

      {activeMap && (
        <MapLightbox
          src={activeMap.src}
          alt={activeMap.alt}
          caption={activeMap.caption}
          open={Boolean(activeMap)}
          onClose={() => setActiveMap(null)}
        />
      )}
    </>
  );
}
