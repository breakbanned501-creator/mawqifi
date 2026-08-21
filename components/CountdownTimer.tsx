'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';

interface CountdownTimerProps {
  expiresAt: number;
  onComplete?: () => void;
}

export default function CountdownTimer({ expiresAt, onComplete }: CountdownTimerProps) {
  const { formatNumber } = useLocale();
  const [timeLeft, setTimeLeft] = useState(0);
  const [visible, setVisible] = useState(true);
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;

    const calculateTimeLeft = () => {
      const difference = expiresAt - Date.now();
      return Math.max(0, Math.floor(difference / 1000));
    };

    const fireComplete = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      setVisible(false);
      onComplete?.();
    };

    const initial = calculateTimeLeft();
    setTimeLeft(initial);

    if (initial === 0) {
      fireComplete();
      return;
    }

    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);
      if (newTimeLeft === 0) {
        fireComplete();
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, onComplete]);

  if (!visible || timeLeft <= 0) return null;

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const formatPart = (value: number, minimumIntegerDigits = 2) =>
      formatNumber(value, { minimumIntegerDigits, useGrouping: false });

    if (hours > 0) {
      return `${formatPart(hours, 1)}:${formatPart(minutes)}:${formatPart(secs)}`;
    }
    return `${formatPart(minutes)}:${formatPart(secs)}`;
  };

  const getTimeColor = (): string => {
    if (timeLeft < 300) return 'text-red-200';
    if (timeLeft < 900) return 'text-yellow-100';
    return 'text-cyan-200';
  };

  return (
    <div
      className={`flex items-center gap-1.5 text-xs font-bold tabular-nums transition-opacity duration-300 ${getTimeColor()}`}
      dir="ltr"
    >
      <Clock size={14} className="shrink-0 animate-pulse-soft" />
      <span>{formatTime(timeLeft)}</span>
    </div>
  );
}
