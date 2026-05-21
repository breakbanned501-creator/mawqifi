import Image from 'next/image';

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
  return (
    <section className="mb-5" aria-label="خرائط إرشادية">
      <p className="mb-3 text-sm font-bold text-white/55">خرائط إرشادية للحرم</p>
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
        {maps.map((map) => (
          <figure
            key={map.src}
            className="glass-card group overflow-hidden p-2 shadow-glow ring-1 ring-cyan-400/15 transition-shadow hover:ring-cyan-400/30"
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
            </div>
            <figcaption className="mt-2 px-1 text-center text-xs font-bold text-cyan-200/80">
              {map.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
