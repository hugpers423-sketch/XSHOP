// apps/web/components/reels/LiveNowRail.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { emojiTile } from '@/lib/format';

interface LiveRailItem {
  id: string;
  title: string;
  hostName: string;
  productName?: string | null;
}

function readLive(value: unknown): LiveRailItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.title !== 'string') return null;
  return {
    id: item.id,
    title: item.title,
    hostName: typeof item.hostName === 'string' && item.hostName ? item.hostName : 'Vendedor X-STORE',
    productName: typeof item.productName === 'string' ? item.productName : null,
  };
}

/** Rail de lives reales: el borde lila identifica una transmisión activa. */
export function LiveNowRail() {
  const [lives, setLives] = useState<LiveRailItem[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/lives', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json() as { data?: unknown[] };
        if (!active || !Array.isArray(data.data)) return;
        setLives(data.data.map(readLive).filter((item): item is LiveRailItem => item !== null).slice(0, 6));
      } catch {
        // El feed sigue funcionando aunque el rail no pueda consultar lives.
      }
    };
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  if (lives.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 top-[4.75rem] z-30 mx-auto max-w-3xl">
      <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1" aria-label="Lives ahora">
        {lives.map((live) => (
          <Link
            key={live.id}
            href={`/live?id=${encodeURIComponent(live.id)}`}
            prefetch={false}
            className="group flex min-w-[220px] shrink-0 items-center gap-2 rounded-2xl border-2 border-violet-400/90 bg-[#150f2b]/95 p-2 shadow-[0_0_24px_rgba(167,139,250,0.35)] backdrop-blur-xl transition hover:border-fuchsia-300 hover:shadow-[0_0_30px_rgba(217,70,239,0.45)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={emojiTile('📡', '#2b1b52')}
              alt=""
              className="h-11 w-11 shrink-0 rounded-xl object-cover"
              loading="lazy"
            />
            <span className="min-w-0 text-left">
              <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-violet-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-400" /> En vivo
              </span>
              <span className="mt-0.5 block truncate text-xs font-bold text-white">{live.title}</span>
              <span className="block truncate text-[10px] text-violet-200/70">{live.hostName} · Abrir live</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
