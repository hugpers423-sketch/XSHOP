// apps/web/components/reels/ReelsFeed.tsx
'use client';

import { ReelItem } from './ReelItem';
import { LiveNowRail } from './LiveNowRail';
import { CommentsBubble } from './CommentsBubble';
import { QuickBuySheet } from './QuickBuySheet';
import { useReelsFeed } from './useReelsFeed';
import { useAuth } from '@/lib/auth-context';
import { recordBehavior } from '@/lib/behavior';
import type { Reel } from './types';

interface ReelsFeedProps {
  reels: Reel[];
  onAddToCart?: (reelId: string, variantId: string, qty: number) => void;
}

export function ReelsFeed({ reels, onAddToCart }: ReelsFeedProps) {
  const feed = useReelsFeed(reels);
  const { requireAuth } = useAuth();

  const handleShare = (reel: Reel) => {
    recordBehavior(reel.id, 'share', 1);
    const url = `${window.location.origin}/reels/${reel.id}`;
    if (navigator.share) {
      navigator.share({ title: reel.product.title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  if (feed.status === 'loading') {
    return (
      <div className="grid h-[100dvh] place-items-center bg-black">
        <p className="animate-pulse text-sm text-white/60">Cargando reels…</p>
      </div>
    );
  }

  return (
    <>
      <LiveNowRail />
      <main
        className="h-[100dvh] w-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain"
        aria-label="Feed de videos de productos"
        style={{ scrollbarWidth: 'none' }}
      >
        {feed.reels.map((reel, index) => (
          <ReelItem
            key={reel.id}
            reel={reel}
            index={index}
            isActive={index === feed.activeIndex}
            isMounted={feed.isMounted(index)}
            muted={feed.muted}
            isLiked={feed.likedIds.has(reel.id)}
            isFollowing={feed.followingIds.has(reel.product.seller.id)}
            registerItem={feed.registerItem}
            onToggleLike={() => { if (requireAuth('like')) feed.toggleLike(reel.id); }}
            onToggleFollow={() => { if (requireAuth('follow')) feed.toggleFollow(reel.product.seller.id); }}
            onOpenComments={() => { if (requireAuth('comment')) feed.openComments(reel.id); }}
            onShare={() => handleShare(reel)}
            onQuickBuy={() => { if (requireAuth('buy')) feed.openQuickBuy(reel.id); }}
            onEnded={() => feed.recordCompletion(reel.id)}
          />
        ))}
      </main>

      <button
        type="button"
        onClick={feed.toggleMute}
        aria-label={feed.muted ? 'Activar sonido' : 'Silenciar'}
        className="fixed right-4 top-16 z-30 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md"
      >
        {feed.muted ? '🔇' : '🔊'}
      </button>

      <CommentsBubble
        reelId={feed.visibleComments ?? ''}
        isOpen={!!feed.visibleComments}
        onClose={feed.closeComments}
      />

      <QuickBuySheet
        reel={feed.reels.find((r) => r.id === feed.quickBuyReelId) ?? null}
        isOpen={!!feed.quickBuyReelId}
        onClose={feed.closeQuickBuy}
        onConfirm={(variantId, qty) => {
          if (feed.quickBuyReelId) onAddToCart?.(feed.quickBuyReelId, variantId, qty);
        }}
      />
    </>
  );
}
