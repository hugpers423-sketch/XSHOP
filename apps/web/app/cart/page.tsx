// apps/web/app/cart/page.tsx
'use client';

import CartCheckout from '@/components/cart/CartCheckout';

// El BottomNav lo monta el layout raíz — no duplicarlo aquí
export default function CartPage() {
  return (
    <main className="min-h-screen bg-zinc-950 pb-20 lg:pb-0">
      <CartCheckout />
    </main>
  );
}
