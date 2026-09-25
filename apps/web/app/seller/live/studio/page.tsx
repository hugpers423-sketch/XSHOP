'use client';

import Link from 'next/link';
import { CameraStudio } from '@/components/live/CameraStudio';

export default function SellerLiveStudioPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 pb-24">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <Link href="/live" className="text-xs text-white/50 transition hover:text-white">← Volver a Live</Link>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-[#FF2D75]">Seller Studio</p>
          <h1 className="mt-1 text-2xl font-black text-white">Transmitir en vivo por cámara</h1>
        </div>
        <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/55 sm:inline-flex">LiveKit · fallback WebRTC local</span>
      </div>
      <CameraStudio />
    </main>
  );
}
