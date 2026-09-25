// app/marketplace/page.tsx
'use client';

import { useState } from 'react';
import { MarketplaceMap } from '@/components/marketplace/MarketplaceMap';
import { ChatWindow } from '@/components/chat/ChatWindow';

const PINS = [
  { id: 'm1', title: 'iPhone 13 128GB - Como nuevo', price: 1850, image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=300', lat: -12.0580, lng: -77.0370, distanceKm: 1.2 },
  { id: 'm2', title: 'Bicicleta MTB 21 velocidades', price: 690, image: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=300', lat: -12.0750, lng: -77.0520, distanceKm: 3.4 },
  { id: 'm3', title: 'Silla gamer ergonómica', price: 320, image: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=300', lat: -12.0410, lng: -77.0300, distanceKm: 2.1 },
  { id: 'm4', title: 'PlayStation 5 + 2 mandos', price: 2450, image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=300', lat: -12.0900, lng: -77.0200, distanceKm: 8.7 },
  { id: 'm5', title: 'Guitarra acústica Yamaha', price: 450, image: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=300', lat: -12.0300, lng: -77.0650, distanceKm: 4.9 },
  { id: 'm6', title: 'Escritorio 1.4m madera maciza', price: 380, image: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=300', lat: -12.0600, lng: -77.0100, distanceKm: 6.3 },
];

export default function MarketplacePage() {
  const [radius, setRadius] = useState(10);
  const [chatOpen, setChatOpen] = useState(false);
  const [selected, setSelected] = useState<typeof PINS[0] | null>(null);

  const visiblePins = PINS.filter((p) => p.distanceKm <= radius);

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              📍 Marketplace <span className="text-cyan-400">Cerca de ti</span>
            </h1>
            <p className="text-sm text-white/50">
              {visiblePins.length} productos dentro de {radius} km
            </p>
          </div>

          {/* Filtros rápidos (wrapping cómodo en móvil) */}
          <div className="flex flex-wrap gap-2 text-xs">
            {['Todo', 'Tecnología', 'Hogar', 'Deportes', 'Moda'].map((f, i) => (
              <button
                key={f}
                className={`rounded-full px-3.5 py-1.5 font-semibold transition ${
                  i === 0
                    ? 'bg-cyan-500 text-black'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Mapa + lista */}
        <MarketplaceMap
          pins={PINS}
          radiusKm={radius}
          onRadiusChange={setRadius}
          onSelect={(pin) => {
            setSelected(pin);
            setChatOpen(true);
          }}
        />
      </div>

      {/* Chat modal (se abre al seleccionar un producto) */}
      {chatOpen && selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="h-[70vh] w-full max-w-lg">
            <ChatWindow
              peerName="Vendedor verificado"
              peerAvatar=""
              productId={selected.id}
              productTitle={selected.title}
              currentUserId="me"
              onSend={() => {
                // Demo: en producción el mensaje viaja por Socket.io
              }}
            />
          </div>
          <button
            onClick={() => setChatOpen(false)}
            aria-label="Cerrar chat"
            className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
