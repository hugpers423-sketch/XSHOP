// apps/web/components/reels/types.ts

export interface Seller {
  id: string;
  username: string;
  avatar: string;
  reputationLevel: 'bronze' | 'silver' | 'gold' | 'platinum';
  rating: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
}

export interface ReelProduct {
  id: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  currency: 'PEN' | 'USD';
  thumbnail: string;
  images: string[];
  variants: ProductVariant[];
  stock: number;
  seller: Seller;
  shippingEstimate: string;
  discountPercent?: number;
}

export interface Reel {
  id: string;
  videoUrl: string;
  videoPoster: string;
  duration: number;
  caption: string;
  hashtags: string[];
  music?: { name: string; artist: string };
  product: ReelProduct;
  stats: {
    likes: number;
    comments: number;
    shares: number;
    purchases: number;
  };
}

export type ReelsFeedStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ReelsFeedState {
  reels: Reel[];
  activeIndex: number;
  status: ReelsFeedStatus;
  muted: boolean;
  likedIds: Set<string>;
  followingIds: Set<string>;
  visibleComments: string | null;
  quickBuyReelId: string | null;
}
