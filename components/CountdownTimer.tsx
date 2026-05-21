'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  expiresAt: number;
  onComplete?: () => void;
}

export default function CountdownTimer({ expiresAt, onComplete }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = expiresAt - Date.now();
      return Math.max(0, Math.floor(difference / 1000));
    };

    setTimeLeft(calculateTimeLeft());
    setIsExpired(calculateTimeLeft() === 0);

    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);
      if (newTimeLeft === 0) {
        setIsExpired(true);
        onComplete?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, onComplete]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getTimeColor = (): string => {
    if (isExpired) return 'text-white/40';
    if (timeLeft < 300) return 'text-red-200';
    if (timeLeft < 900) return 'text-yellow-100';
    return 'text-cyan-200';
  };

  return (
    <div className={`flex items-center gap-1.5 text-xs font-bold ${getTimeColor()}`} dir="ltr">
      <Clock size={14} className="shrink-0" />
      <span className="tabular-nums">{isExpired ? 'منتهي' : formatTime(timeLeft)}</span>
    </div>
  );
}
