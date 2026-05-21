'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

type MapLightboxProps = {
  src: string;
  alt: string;
  caption: string;
  open: boolean;
  onClose: () => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function getTouchDistance(touches: React.TouchList) {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

export default function MapLightbox({ src, alt, caption, open, onClose }: MapLightboxProps) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const pinchStartDist = useRef(0);
  const pinchStartScale = useRef(1);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const resetView = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!open) return;
    resetView();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, resetView]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStartDist.current = getTouchDistance(e.touches);
      pinchStartScale.current = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      panStart.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        tx: translate.x,
        ty: translate.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDist.current > 0) {
      e.preventDefault();
      const dist = getTouchDistance(e.touches);
      const next = clampScale(pinchStartScale.current * (dist / pinchStartDist.current));
      setScale(next);
      if (next <= 1) setTranslate({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && scale > 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - panStart.current.x;
      const dy = e.touches[0].clientY - panStart.current.y;
      setTranslate({
        x: panStart.current.tx + dx,
        y: panStart.current.ty + dy,
      });
    }
  };

  const handleTouchEnd = () => {
    pinchStartDist.current = 0;
    if (scale <= 1.05) resetView();
  };

  const zoomIn = () => setScale((s) => clampScale(s + 0.5));
  const zoomOut = () => {
    setScale((s) => {
      const next = clampScale(s - 0.5);
      if (next <= 1) setTranslate({ x: 0, y: 0 });
      return next;
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-navy-950/85 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 safe-top">
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-cyan-200/90">{caption}</p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              zoomOut();
            }}
            className="rounded-full bg-white/10 p-2.5 text-white/80"
            aria-label="تصغير"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              zoomIn();
            }}
            className="rounded-full bg-white/10 p-2.5 text-white/80"
            aria-label="تكبير"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="rounded-full bg-cyan-500/20 p-2.5 text-cyan-100 ring-1 ring-cyan-400/40"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        className="relative flex flex-1 touch-none items-center justify-center overflow-hidden px-3 pb-6"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div
          className="max-h-full max-w-full transition-transform duration-75 will-change-transform"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          }}
        >
          <Image
            src={src}
            alt={alt}
            width={1200}
            height={900}
            className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain shadow-[0_0_40px_rgba(0,212,255,0.25)]"
            unoptimized
            draggable={false}
          />
        </div>
      </div>

      <p className="pb-4 text-center text-xs text-white/45">قرصة للتكبير · اسحب للتحريك</p>
    </div>
  );
}
