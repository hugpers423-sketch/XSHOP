// apps/web/components/marketplace/MarketplaceMap.tsx
'use client';

// Mapa hipergeolocalizado (Marketplace-style, mobile-first):
// - Leaflet vía CDN (lazy, sin bundler pesado) + tiles OpenStreetMap
// - Init ÚNICA por montaje (evita "Map container already initialized")
// - Botón "Mi ubicación" con geolocalización real del dispositivo
// - Radio de búsqueda sincronizado (círculo + lista filtrada)
// - Fallback elegante con reintento si Leaflet no carga (offline/red/CSP)

import { useEffect, useRef, useState } from 'react';
import { toast } from '@/components/ui/Toast';

export interface MapPin {
  id: string;
  title: string;
  price: number;
  image: string;
  lat: number;
  lng: number;
  distanceKm: number;
}

interface MarketplaceMapProps {
  pins: MapPin[];
  radiusKm: number;
  onRadiusChange: (km: number) => void;
  onSelect: (pin: MapPin) => void;
}

type MapStatus = 'loading' | 'ready' | 'error';
type GeoStatus = 'idle' | 'locating' | 'ok' | 'denied';

/** Ubicación por defecto cuando el usuario aún no comparte su posición */
const LIMA: [number, number] = [-12.0464, -77.0428];

// ============================================================
// Carga del CDN (una sola promesa por página, reutilizable)
// ============================================================

let leafletPromise: Promise<void> | null = null;

function loadLeafletOnce(): Promise<void> {
  if (window.L) return Promise.resolve();
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise<void>((resolve, reject) => {
    if (!document.querySelector('link[data-leaflet="1"]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      css.setAttribute('data-leaflet', '1');
      document.head.appendChild(css);
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.setAttribute('data-leaflet', '1');
    script.onload = () => resolve();
    script.onerror = () => {
      // Permitir reintento limpio
      leafletPromise = null;
      script.remove();
      reject(new Error('No se pudo cargar Leaflet'));
    };
    document.head.appendChild(script);
  });

  return leafletPromise;
}

/** Icono-mancheta "S/ precio" para cada producto */
function priceIcon(L: LeafletNamespace, price: number): unknown {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:linear-gradient(135deg,#0b0f1a,#1e1b4b);
      border:1px solid rgba(34,211,238,.5);
      border-radius:12px;padding:4px 8px;
      color:#fff;font-size:11px;font-weight:700;
      white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.5);
      cursor:pointer">S/ ${price.toFixed(0)}</div>`,
    iconAnchor: [20, 10],
  });
}

// ============================================================
// Componente
// ============================================================

export function MarketplaceMap({ pins, radiusKm, onRadiusChange, onSelect }: MarketplaceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const LRef = useRef<LeafletNamespace | null>(null);
  const userMarkerRef = useRef<LeafletCircleMarker | null>(null);
  const radiusCircleRef = useRef<LeafletCircle | null>(null);
  const pinMarkersRef = useRef<LeafletMarker[]>([]);

  // Últimos valores para la init (evitan re-init por cambios de props)
  const pinsRef = useRef(pins);
  const radiusRef = useRef(radiusKm);
  const userPosRef = useRef<[number, number]>(LIMA);

  const [status, setStatus] = useState<MapStatus>('loading');
  const [retry, setRetry] = useState(0);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);
  const [userPos, setUserPos] = useState<[number, number]>(LIMA);
  const [geoState, setGeoState] = useState<GeoStatus>('idle');

  // Sincronizar refs (escritura en efecto, nunca durante el render)
  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);
  useEffect(() => {
    radiusRef.current = radiusKm;
  }, [radiusKm]);
  useEffect(() => {
    userPosRef.current = userPos;
  }, [userPos]);

  // ---------- Init única del mapa (reintento manual posible) ----------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let resizeHandler: (() => void) | null = null;
    let settleTimer: number | null = null;
    setStatus('loading');

    (async () => {
      await loadLeafletOnce();
      const L = window.L;
      const el = containerRef.current;
      if (!L || !el) throw new Error('Leaflet no disponible');
      if (cancelled) return;

      const map = L.map(el).setView(userPosRef.current, 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      // Marcador del usuario
      const userMarker = L.circleMarker(userPosRef.current, {
        radius: 8,
        color: '#22d3ee',
        fillColor: '#22d3ee',
        fillOpacity: 1,
      })
        .addTo(map)
        .bindPopup('<b>Tu ubicación</b>');

      // Círculo del radio de búsqueda
      const circle = L.circle(userPosRef.current, {
        radius: radiusRef.current * 1000,
        color: '#22d3ee',
        weight: 1,
        fillColor: '#22d3ee',
        fillOpacity: 0.08,
      }).addTo(map);

      // Pines iniciales (filtrados por radio)
      const markers = pinsRef.current
        .filter((p) => p.distanceKm <= radiusRef.current)
        .map((pin) =>
          L.marker([pin.lat, pin.lng], { icon: priceIcon(L, pin.price) })
            .addTo(map)
            .on('click', () => setSelectedPin(pin))
        );

      if (cancelled) {
        map.remove();
        return;
      }

      LRef.current = L;
      mapRef.current = map;
      userMarkerRef.current = userMarker;
      radiusCircleRef.current = circle;
      pinMarkersRef.current = markers;

      // Ajuste de tamaño al reflow (móvil: barra de navegador, orientación)
      resizeHandler = () => map.invalidateSize();
      window.addEventListener('resize', resizeHandler);
      settleTimer = window.setTimeout(() => map.invalidateSize(), 100);

      setStatus('ready');
    })().catch(() => {
      // Silencioso: el estado 'error' muestra el panel de reintento
      if (!cancelled) setStatus('error');
    });

    return () => {
      cancelled = true;
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
      if (settleTimer) window.clearTimeout(settleTimer);
      pinMarkersRef.current = [];
      userMarkerRef.current = null;
      radiusCircleRef.current = null;
      const map = mapRef.current;
      mapRef.current = null;
      LRef.current = null;
      if (map) map.remove();
    };
  }, [retry]);

  // ---------- Pines + radio: re-sincronizar sin re-init ----------
  useEffect(() => {
    if (status !== 'ready') return;
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    // Radio del círculo
    radiusCircleRef.current?.setRadius(radiusKm * 1000);

    // Pines dentro del radio
    pinMarkersRef.current.forEach((m) => m.remove());
    pinMarkersRef.current = pins
      .filter((p) => p.distanceKm <= radiusKm)
      .map((pin) =>
        L.marker([pin.lat, pin.lng], { icon: priceIcon(L, pin.price) })
          .addTo(map)
          .on('click', () => setSelectedPin(pin))
      );
  }, [pins, radiusKm, status]);

  // ---------- Geolocalización real del dispositivo ----------
  function locate(): void {
    if (!navigator.geolocation) {
      setGeoState('denied');
      toast.error('Tu navegador no soporta geolocalización');
      return;
    }
    setGeoState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(coords);
        userPosRef.current = coords;
        userMarkerRef.current?.setLatLng(coords);
        radiusCircleRef.current?.setLatLng(coords);
        mapRef.current?.setView(coords, 14);
        setGeoState('ok');
        toast.success('📍 Mostrando productos cerca de ti');
      },
      () => {
        setGeoState('denied');
        toast.info('No obtuvimos tu ubicación — mostrando Lima Centro');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
    );
  }

  return (
    <div className="space-y-3">
      {/* Fila de controles: radio + botón de ubicación (toc-friendly) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <span className="text-sm text-white/70">
          📍 Productos a menos de <b className="text-cyan-400">{radiusKm} km</b>
        </span>
        <div className="flex flex-1 items-center justify-end gap-3">
          <button
            type="button"
            onClick={locate}
            disabled={geoState === 'locating'}
            className="shrink-0 rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/20 active:scale-95 disabled:opacity-50"
          >
            {geoState === 'locating' ? '⏳ Ubicando…' : '🎯 Mi ubicación'}
          </button>
          <input
            type="range"
            min={1}
            max={50}
            value={radiusKm}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            aria-label="Radio de búsqueda en kilómetros"
            className="w-full min-w-32 max-w-48 accent-cyan-400"
          />
        </div>
      </div>

      {/* Contenedor del mapa (alto cómodo en móvil, fijo en escritorio) */}
      <div className="relative h-[55vh] min-h-[320px] overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 sm:h-[420px]">
        <div
          ref={containerRef}
          aria-label="Mapa de productos cercanos"
          className="h-full w-full"
        />

        {status === 'loading' && (
          <div className="absolute inset-0 grid place-items-center bg-zinc-900">
            <p className="animate-pulse text-sm text-white/50">Cargando mapa…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 grid place-items-center bg-zinc-900 p-6 text-center">
            <div>
              <p className="text-3xl">🗺️</p>
              <p className="mt-2 text-sm font-semibold text-white/80">
                No pudimos cargar el mapa
              </p>
              <p className="mt-1 text-xs text-white/45">
                Revisa tu conexión e inténtalo de nuevo.
              </p>
              <button
                type="button"
                onClick={() => setRetry((r) => r + 1)}
                className="mt-4 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-bold text-black transition active:scale-95"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* Card preview del pin seleccionado */}
        {selectedPin && (
          <div className="absolute bottom-4 left-4 right-4 z-[1000] flex items-center gap-3 rounded-2xl border border-cyan-400/30 bg-zinc-950/95 p-3 backdrop-blur-xl md:right-auto md:w-80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedPin.image}
              alt={selectedPin.title}
              className="h-16 w-16 rounded-xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{selectedPin.title}</p>
              <p className="text-lg font-black text-emerald-400">
                S/ {selectedPin.price.toFixed(2)}
              </p>
              <p className="text-[11px] text-white/40">
                A {selectedPin.distanceKm.toFixed(1)} km de ti
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onSelect(selectedPin);
                setSelectedPin(null);
              }}
              className="rounded-xl bg-cyan-500 px-3 py-2 text-xs font-bold text-black"
            >
              Ver
            </button>
            <button
              type="button"
              onClick={() => setSelectedPin(null)}
              aria-label="Cerrar"
              className="absolute right-2 top-2 text-white/40 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Lista compacta debajo del mapa (filtrada por radio) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {pins
          .filter((p) => p.distanceKm <= radiusKm)
          .map((pin) => (
            <button
              key={pin.id}
              type="button"
              onClick={() => onSelect(pin)}
              className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left transition hover:border-cyan-400/50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pin.image}
                alt={pin.title}
                className="h-24 w-full object-cover"
                loading="lazy"
              />
              <div className="p-2.5">
                <p className="line-clamp-1 text-xs font-semibold text-white">{pin.title}</p>
                <p className="text-sm font-black text-emerald-400">
                  S/ {pin.price.toFixed(2)}
                </p>
                <p className="text-[10px] text-white/40">📍 {pin.distanceKm.toFixed(1)} km</p>
              </div>
            </button>
          ))}
      </div>
    </div>
  );
}
