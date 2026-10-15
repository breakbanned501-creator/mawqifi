'use client';

import LegacyParkingHome from '@/components/LegacyParkingHome';
import ReverseParkingHome from '@/components/ReverseParkingHome';

function reverseMatchingEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_REVERSE_MATCHING !== '1') return false;
  try {
    const hostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname;
    return hostname === 'jrmiwmsgnztqwbigumlw.supabase.co' ||
      hostname === 'opsyvdsivxoqphkfdsbb.supabase.co';
  } catch {
    return false;
  }
}

export default function Home() {
  return reverseMatchingEnabled() ? <ReverseParkingHome /> : <LegacyParkingHome />;
}
