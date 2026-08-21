'use client';

import { MapPin } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import CampusMapGallery from '@/components/CampusMapGallery';
import { useLocale } from '@/components/LocaleProvider';
import PageHeader from '@/components/PageHeader';
import {
  collegesByZone,
  formatGate,
  formatParkingArea,
  getCollegeName,
  getZoneDescription,
  getZoneLandmark,
  kuZones,
} from '@/lib/university';

export default function MapPage() {
  const { dir, locale, t } = useLocale();

  return (
    <main className="page-with-chrome min-h-screen px-4 pt-6 text-white" dir={dir}>
      <div className="mx-auto max-w-md md:max-w-xl lg:max-w-2xl space-y-5">
        <PageHeader
          title={t('map.title')}
          subtitle={t('map.subtitle')}
          backHref="/"
        />

        <CampusMapGallery />

        {kuZones.map((zone) => {
          const colleges = collegesByZone(zone.id);
          return (
            <article key={zone.id} className="glass-card overflow-hidden">
              <div className="flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-cyan-500/20 to-navy-900/40">
                <div className="px-6 text-center">
                  <MapPin className="mx-auto mb-3 h-10 w-10 text-cyan-300" />
                  <p className="text-xl font-black">{locale === 'en' ? zone.nameEn : zone.nameAr}</p>
                  <p className="mt-1 text-sm text-white/55" dir="auto">{getZoneLandmark(zone, locale)}</p>
                </div>
              </div>
              <div className="space-y-4 p-4">
                <p className="text-sm leading-7 text-white/70">{getZoneDescription(zone, locale)}</p>
                <ul className="space-y-3">
                  {colleges.map((college) => (
                    <li
                      key={college.nameAr}
                      className="rounded-2xl border border-white/10 bg-navy-950/50 p-3"
                    >
                      <h3 className="font-extrabold text-white">{getCollegeName(college, locale)}</h3>
                      <p className="mt-1 text-xs text-white/45" dir="auto">
                        {locale === 'ar' ? college.nameEn : college.nameAr}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {college.gates.map((gate) => (
                          <span
                            key={gate}
                            className="rounded-full bg-cyan-400/10 px-2.5 py-1 font-bold text-cyan-200"
                          >
                            {formatGate(gate, locale)}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-xs leading-6 text-white/50">
                        {t('map.parking', {
                          parking: college.parking
                            .map((parkingArea) => formatParkingArea(parkingArea, locale))
                            .join(' · '),
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}

        <div className="rounded-3xl border border-yellow-300/20 bg-yellow-400/10 p-4 text-center">
          <p className="text-sm font-semibold leading-7 text-yellow-100">
            {t('map.notice')}
          </p>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
