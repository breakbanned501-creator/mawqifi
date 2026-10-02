'use client';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import {useLocale} from '@/components/LocaleProvider';
export default function MapPage(){const {t,dir}=useLocale();return <main dir={dir} className="page-with-chrome px-4 pt-8"><section className="glass-card mx-auto max-w-md space-y-4 p-5"><p>{t('handoff.history')}</p><Link className="btn btn-primary block text-center" href="/conversations">{t('home.chat')}</Link></section><BottomNav/></main>;}
