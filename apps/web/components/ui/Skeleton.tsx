// apps/web/components/ui/Skeleton.tsx
// Skeletons de carga (reducen CLS y mejoran percepción de velocidad)

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-white/10 ${className}`}
      aria-hidden
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <Skeleton className="h-40 w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-6 w-1/3" />
      </div>
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-black">
      <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-cyan-400" />
      <p className="text-sm text-white/50">Preparando tu feed…</p>
    </div>
  );
}

// Export por defecto para imports `import Skeleton from ...`
export default Skeleton;

export function ChatSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
          <Skeleton className={`h-12 ${i % 2 ? 'w-1/2' : 'w-2/3'} rounded-2xl`} />
        </div>
      ))}
    </div>
  );
}
