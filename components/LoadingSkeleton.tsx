/**
 * Loading skeleton component for smooth loading states
 */

interface LoadingSkeletonProps {
  className?: string;
}

export function CardSkeleton({ className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`glass-card p-4 space-y-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 animate-pulse rounded-2xl bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-3/4 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
        </div>
      </div>
      <div className="h-16 w-full animate-pulse rounded-2xl bg-white/5" />
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
        </div>
        <div className="h-8 w-20 animate-pulse rounded-2xl bg-white/10" />
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 3, className = '' }: LoadingSkeletonProps & { count?: number }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card p-4 flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-2xl bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TextSkeleton({ className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="h-4 w-full animate-pulse rounded bg-white/10" />
      <div className="h-4 w-5/6 animate-pulse rounded bg-white/10" />
      <div className="h-4 w-4/6 animate-pulse rounded bg-white/10" />
    </div>
  );
}

export function ButtonSkeleton({ className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`h-12 w-full animate-pulse rounded-2xl bg-white/10 ${className}`} />
  );
}
