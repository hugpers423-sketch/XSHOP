// apps/web/components/reels/useReelsFeed.ts
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rankReels, recordBehavior } from '@/lib/behavior';
import type { Reel, ReelsFeedState } from './types';

const WINDOW_AHEAD = 2;   // precarga 2 videos posteriores
const WINDOW_BEHIND = 1;  // mantiene 1 anterior en memoria

export function useReelsFeed(reels: Reel[]) {
  const rankedReels = useMemo(() => rankReels(reels), [reels]);
  const [state, setState] = useState<ReelsFeedState>({
    reels: rankedReels,
    activeIndex: 0,
    status: reels.length ? 'ready' : 'loading',
    muted: true,
    likedIds: new Set(),
    visibleComments: null,
    quickBuyReelId: null,
  });

  useEffect(() => {
    setState((prev) => ({ ...prev, reels: rankedReels, activeIndex: 0 }));
  }, [rankedReels]);

  useEffect(() => {
    const activeReel = state.reels[state.activeIndex];
    if (!activeReel) return;
    const startedAt = Date.now();
    recordBehavior(activeReel.id, 'view');
    return () => {
      const seconds = Math.min(120, (Date.now() - startedAt) / 1000);
      if (seconds >= 2) recordBehavior(activeReel.id, 'view', seconds);
    };
  }, [state.activeIndex, state.reels]);

  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
            const index = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(index)) {
              setState((prev) =>
                prev.activeIndex === index ? prev : { ...prev, activeIndex: index }
              );
            }
          }
        }
      },
      { threshold: [0.7] }
    );

    const observer = observerRef.current;
    itemRefs.current.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [state.reels]);

  const registerItem = useCallback((id: string, el: HTMLElement | null) => {
    if (el) {
      itemRefs.current.set(id, el);
      observerRef.current?.observe(el);
    } else {
      itemRefs.current.delete(id);
    }
  }, []);

  const preloadWindow = useMemo(() => {
    const start = Math.max(0, state.activeIndex - WINDOW_BEHIND);
    const end = Math.min(state.reels.length - 1, state.activeIndex + WINDOW_AHEAD);
    return { start, end };
  }, [state.activeIndex, state.reels.length]);

  const isMounted = useCallback(
    (index: number) => index >= preloadWindow.start && index <= preloadWindow.end,
    [preloadWindow]
  );

  const toggleLike = useCallback((reelId: string) => {
    const wasLiked = state.likedIds.has(reelId);
    recordBehavior(reelId, wasLiked ? 'view' : 'like', wasLiked ? -1 : 1);
    setState((prev) => {
      const likedIds = new Set(prev.likedIds);
      if (likedIds.has(reelId)) likedIds.delete(reelId);
      else likedIds.add(reelId);
      return { ...prev, likedIds };
    });
  }, [state.likedIds]);

  const recordCompletion = useCallback((reelId: string) => {
    recordBehavior(reelId, 'complete', 1);
  }, []);

  const toggleMute = useCallback(() => {
    setState((prev) => ({ ...prev, muted: !prev.muted }));
  }, []);

  const openComments = useCallback((reelId: string) => {
    setState((prev) => ({ ...prev, visibleComments: reelId }));
  }, []);

  const closeComments = useCallback(() => {
    setState((prev) => ({ ...prev, visibleComments: null }));
  }, []);

  const openQuickBuy = useCallback((reelId: string) => {
    setState((prev) => ({ ...prev, quickBuyReelId: reelId }));
  }, []);

  const closeQuickBuy = useCallback(() => {
    setState((prev) => ({ ...prev, quickBuyReelId: null }));
  }, []);

  return {
    ...state,
    registerItem,
    isMounted,
    toggleLike,
    recordCompletion,
    toggleMute,
    openComments,
    closeComments,
    openQuickBuy,
    closeQuickBuy,
  };
}
