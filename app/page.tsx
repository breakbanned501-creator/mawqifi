'use client';

import LegacyParkingHome from '@/components/LegacyParkingHome';
import ReverseParkingHome from '@/components/ReverseParkingHome';

function reverseMatchingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_REVERSE_MATCHING === '1';
}

export default function Home() {
  return reverseMatchingEnabled() ? <ReverseParkingHome /> : <LegacyParkingHome />;
}
