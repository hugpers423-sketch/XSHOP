export {};

declare global {
  interface LeafletMap {
    setView(center: [number, number], zoom?: number): LeafletMap;
    invalidateSize(): void;
    remove(): void;
  }

  interface LeafletMarker {
    addTo(map: LeafletMap): LeafletMarker;
    on(event: string, handler: () => void): LeafletMarker;
    remove(): void;
  }

  interface LeafletCircleMarker {
    addTo(map: LeafletMap): LeafletCircleMarker;
    bindPopup(html: string): LeafletCircleMarker;
    setLatLng(center: [number, number]): LeafletCircleMarker;
  }

  interface LeafletCircle {
    addTo(map: LeafletMap): LeafletCircle;
    setRadius(radius: number): LeafletCircle;
    setLatLng(center: [number, number]): LeafletCircle;
  }

  interface LeafletLayer {
    addTo(map: LeafletMap): LeafletLayer;
  }

  interface LeafletNamespace {
    map(element: HTMLElement): LeafletMap;
    tileLayer(url: string, options?: Record<string, unknown>): LeafletLayer;
    circleMarker(center: [number, number], options?: Record<string, unknown>): LeafletCircleMarker;
    circle(center: [number, number], options?: Record<string, unknown>): LeafletCircle;
    marker(center: [number, number], options?: Record<string, unknown>): LeafletMarker;
    divIcon(options: Record<string, unknown>): unknown;
  }

  interface Window {
    L?: LeafletNamespace;
  }
}
