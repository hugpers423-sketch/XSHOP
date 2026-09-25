// apps/web/components/product/VariantSelector.tsx
'use client';

interface Variant {
  id: string;
  name: string;
  price: number;
  stock: number;
  color?: string;
}

interface VariantSelectorProps {
  variants: Variant[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function VariantSelector({ variants, selectedId, onSelect }: VariantSelectorProps) {
  if (variants.length === 0) return null;

  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
        Elige tu opción
      </legend>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const isSelected = v.id === selectedId;
          const isOut = v.stock === 0;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => !isOut && onSelect(v.id)}
              disabled={isOut}
              aria-pressed={isSelected}
              className={`relative rounded-xl border px-4 py-2.5 text-xs font-medium transition ${
                isSelected
                  ? 'border-cyan-400 bg-cyan-400/15 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                  : 'border-white/15 text-white/70 hover:border-white/40'
              } ${isOut ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              {v.name}
              {v.stock > 0 && v.stock <= 5 && (
                <span className="ml-1 text-[10px] text-amber-400">¡quedan {v.stock}!</span>
              )}
              {isOut && ' (agotado)'}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
