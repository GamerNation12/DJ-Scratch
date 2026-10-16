interface SkeletonProps {
  className?: string;
}

/** Shimmer placeholder. Shape via className (w/h/rounded). */
export function Skeleton({ className = "" }: SkeletonProps) {
  return <div aria-hidden="true" className={`animate-pulse bg-white/5 ${className}`} />;
}

export function SkeletonLines({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse bg-white/5 rounded-lg h-4" style={{ width: `${100 - i * 12}%` }} />
      ))}
    </div>
  );
}
