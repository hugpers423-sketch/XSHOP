'use client';

import type { Reel } from '@/components/reels/types';

const STORAGE_KEY = 'xshop-recommendation-events-v1';

type BehaviorEvent = {
  reelId: string;
  kind: 'view' | 'like' | 'complete' | 'share' | 'follow';
  value: number;
  at: number;
};

function readEvents(): BehaviorEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEvents(events: BehaviorEvent[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-500)));
  } catch {
    // El feed sigue funcionando si el almacenamiento está bloqueado.
  }
}

export function recordBehavior(reelId: string, kind: BehaviorEvent['kind'], value = 1): void {
  const events = readEvents();
  events.push({ reelId, kind, value: Math.max(0, value), at: Date.now() });
  writeEvents(events);
}

export function getRecommendationScores(reelIds: string[]): Map<string, number> {
  const scores = new Map(reelIds.map((id) => [id, 0]));
  for (const event of readEvents()) {
    if (!scores.has(event.reelId)) continue;
    const weight = event.kind === 'follow' ? 5 : event.kind === 'like' ? 4 : event.kind === 'complete' ? 3 : event.kind === 'share' ? 2 : 1;
    scores.set(event.reelId, (scores.get(event.reelId) || 0) + event.value * weight);
  }
  return scores;
}

/** Ordena el feed localmente; el backend puede sustituir esta función sin cambiar la UI. */
export function rankReels(reels: Reel[], interests: string[] = []): Reel[] {
  if (typeof window === 'undefined' || reels.length < 2) return reels;
  const originalIndex = new Map(reels.map((reel, index) => [reel.id, index]));
  const scores = getRecommendationScores(reels.map((reel) => reel.id));
  const normalizedInterests = interests.map((interest) => interest.trim().toLowerCase()).filter(Boolean);
  const interestBoost = (reel: Reel) => {
    if (normalizedInterests.length === 0) return 0;
    const searchable = `${reel.caption} ${reel.hashtags.join(' ')}`.toLowerCase();
    return normalizedInterests.some((interest) => searchable.includes(interest)) ? 8 : 0;
  };
  return [...reels].sort((a, b) => {
    const scoreDiff = (scores.get(b.id) || 0) + interestBoost(b) - ((scores.get(a.id) || 0) + interestBoost(a));
    return scoreDiff || (originalIndex.get(a.id) || 0) - (originalIndex.get(b.id) || 0);
  });
}
