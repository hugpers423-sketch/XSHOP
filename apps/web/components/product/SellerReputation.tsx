// apps/web/components/product/SellerReputation.tsx
'use client';

interface SellerReputationProps {
  username: string;
  avatar: string;
  level: 'bronze' | 'silver' | 'gold' | 'platinum';
  rating: number;
  totalSales: number;
  responseTime: string;
  onMessage: () => void;
}

const LEVELS = {
  bronze: { label: 'Bronce', color: 'text-amber-600', icon: '🥉', min: 0 },
  silver: { label: 'Plata', color: 'text-slate-300', icon: '🥈', min: 50 },
  gold: { label: 'Oro', color: 'text-yellow-400', icon: '🥇', min: 200 },
  platinum: { label: 'Platino', color: 'text-cyan-300', icon: '💎', min: 1000 },
};

/**
 * Reputación del vendedor estilo Mercado Libre:
 * - Barra de nivel con progreso
 * - Estrellas + calificación numérica
 * - Métricas de ventas y tiempo de respuesta
 * - Botón de chat directo (Marketplace)
 */
export function SellerReputation({
  username, avatar, level, rating, totalSales, responseTime, onMessage,
}: SellerReputationProps) {
  const cfg = LEVELS[level];
  const nextLevel = Object.values(LEVELS).find((l) => l.min > totalSales);
  const progress = nextLevel
    ? Math.min(100, ((totalSales - cfg.min) / (nextLevel.min - cfg.min)) * 100)
    : 100;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="relative">
          <img
            src={avatar || '/img/default-avatar.png'}
            alt={username}
            className="h-14 w-14 rounded-full border-2 border-white/20 object-cover"
          />
          <span className="absolute -bottom-1 -right-1 text-lg" title={cfg.label}>
            {cfg.icon}
          </span>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{username}</span>
            <span className={`rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold ${cfg.color}`}>
              {cfg.label}
            </span>
          </div>

          {/* Estrellas */}
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="text-sm text-yellow-400" aria-label={`${rating} de 5 estrellas`}>
              {'★'.repeat(Math.round(rating))}
              <span className="text-white/25">{'★'.repeat(5 - Math.round(rating))}</span>
            </span>
            <span className="text-xs font-bold text-white">{rating.toFixed(1)}</span>
            <span className="text-xs text-white/40">({totalSales} ventas)</span>
          </div>
        </div>

        <button
          onClick={onMessage}
          className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-300 transition hover:bg-cyan-400/20"
        >
          💬 Chat
        </button>
      </div>

      {/* Barra de progreso de reputación */}
      <div className="mt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-white/40">
          <span>⚡ Responde en {responseTime}</span>
          <span>{nextLevel ? `Faltan ${nextLevel.min - totalSales} ventas para ${nextLevel.label}` : 'Nivel máximo'}</span>
        </div>
      </div>
    </div>
  );
}
