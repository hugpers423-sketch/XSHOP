// apps/web/components/reels/ReelItem.tsx
'use client';

import { useCallback, useEffect, useRef } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { ReelOverlay } from './ReelOverlay';
import type { Reel } from './types';

interface ReelItemProps {
  reel: Reel;
  index: number;
  isActive: boolean;
  isMounted: boolean;
  muted: boolean;
  isLiked: boolean;
  isFollowing: boolean;
  registerItem: (id: string, el: HTMLElement | null) => void;
  onToggleLike: () => void;
  onToggleFollow: () => void;
  onOpenComments: () => void;
  onShare: () => void;
  onQuickBuy: () => void;
  onEnded?: () => void;
}

export function ReelItem(props: ReelItemProps) {
  const { reel, index, isActive, isMounted, muted, registerItem } = props;
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    registerItem(reel.id, containerRef.current);
    return () => registerItem(reel.id, null);
  }, [reel.id, registerItem]);

  const handlePlay = useCallback(() => {}, []);
  const handlePause = useCallback(() => {}, []);

  return (
    <section
      ref={containerRef}
      data-index={index}
      aria-label={`Video ${index + 1}: ${reel.caption}`}
      className="relative h-[100dvh] w-full shrink-0 snap-start snap-always overflow-hidden bg-black"
    >
      <VideoPlayer
        src={reel.videoUrl}
        poster={reel.videoPoster}
        isActive={isActive}
        isMounted={isMounted}
        muted={muted}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={props.onEnded}
      />

      {reel.music && (
        <div className="absolute left-4 top-20 z-20 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-md">
          <span className="text-xs">🎵</span>
          <span className="max-w-[140px] truncate text-[11px] text-white/90">
            {reel.music.name} · {reel.music.artist}
          </span>
        </div>
      )}

      <ReelOverlay
        reel={reel}
        isLiked={props.isLiked}
        isFollowing={props.isFollowing}
        onToggleLike={props.onToggleLike}
        onToggleFollow={props.onToggleFollow}
        onOpenComments={props.onOpenComments}
        onShare={props.onShare}
        onQuickBuy={props.onQuickBuy}
      />
    </section>
  );
}
