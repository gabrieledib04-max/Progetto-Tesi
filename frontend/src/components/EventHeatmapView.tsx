import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Flame,
  Navigation,
  Maximize2,
  MapPin,
  Heart,
  ExternalLink,
  Calendar,
  ShieldCheck,
  Sun,
  X,
  Zap,
} from 'lucide-react';
import { ScoredEvent } from '@eventspot/shared';
import { SearchFilters } from '../api/client.js';

interface HeatPoint {
  lat: number;
  lon: number;
  intensity: number; // 0.0 to 1.0
}

/**
 * Generates a 256-entry RGBA lookup table matching EventSpot OLED + Carta da Zucchero palette:
 * Deep Navy -> Cyan -> Carta da Zucchero (#6bb8d9) -> Hot Amber -> Blaze Coral
 */
function buildThermalPalette(): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new Uint8ClampedArray(256 * 4);

  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0.0, 'rgba(30, 58, 138, 0)');
  grad.addColorStop(0.25, 'rgba(56, 189, 248, 0.55)');
  grad.addColorStop(0.50, 'rgba(107, 184, 217, 0.78)');
  grad.addColorStop(0.75, 'rgba(245, 158, 11, 0.90)');
  grad.addColorStop(1.0, 'rgba(239, 68, 68, 0.96)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 1);
  return ctx.getImageData(0, 0, 256, 1).data;
}

class ThermalCanvasLayer extends L.Layer {
  private canvas: HTMLCanvasElement | null = null;
  private points: HeatPoint[] = [];
  private palette: Uint8ClampedArray;
  private mapRef: L.Map | null = null;

  constructor(points: HeatPoint[]) {
    super();
    this.points = points;
    this.palette = buildThermalPalette();
  }

  public setPoints(points: HeatPoint[]) {
    this.points = points;
    this.redraw();
  }

  override onAdd(map: L.Map): this {
    this.mapRef = map;
    const canvas = L.DomUtil.create('canvas', 'eventspot-heatmap-canvas');
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '250';
    this.canvas = canvas;

    map.getPanes().overlayPane.appendChild(canvas);
    map.on('move', this.redraw, this);
    map.on('moveend', this.redraw, this);
    map.on('zoomend', this.redraw, this);
    map.on('resize', this.redraw, this);

    this.redraw();
    return this;
  }

  override onRemove(map: L.Map): this {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    map.off('move', this.redraw, this);
    map.off('moveend', this.redraw, this);
    map.off('zoomend', this.redraw, this);
    map.off('resize', this.redraw, this);
    this.canvas = null;
    this.mapRef = null;
    return this;
  }

  private redraw = () => {
    const map = this.mapRef;
    const canvas = this.canvas;
    if (!map || !canvas) return;

    const size = map.getSize();
    if (size.x <= 0 || size.y <= 0) return;

    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(canvas, topLeft);

    if (canvas.width !== size.x || canvas.height !== size.y) {
      canvas.width = size.x;
      canvas.height = size.y;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, size.x, size.y);
    if (this.points.length === 0) return;

    const zoom = map.getZoom();
    // Smooth zoom-adaptive kernel radius so urban clusters blend naturally
    const radius = Math.max(36, Math.min(82, 24 + zoom * 3.5));

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const pt of this.points) {
      const p = map.latLngToContainerPoint([pt.lat, pt.lon]);
      if (p.x < -radius || p.y < -radius || p.x > size.x + radius || p.y > size.y + radius) {
        continue;
      }

      const alpha = Math.max(0.22, Math.min(0.95, pt.intensity));
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      grad.addColorStop(0.45, `rgba(255, 255, 255, ${alpha * 0.48})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Map greyscale accumulated heat to LUT thermal palette
    const imgData = ctx.getImageData(0, 0, size.x, size.y);
    const pixels = imgData.data;

    for (let i = 0; i < pixels.length; i += 4) {
      const heat = pixels[i]; // R channel in 0..255
      if (heat < 5) {
        pixels[i + 3] = 0;
        continue;
      }
      const idx = heat * 4;
      pixels[i] = this.palette[idx];
      pixels[i + 1] = this.palette[idx + 1];
      pixels[i + 2] = this.palette[idx + 2];
      pixels[i + 3] = this.palette[idx + 3];
    }

    ctx.putImageData(imgData, 0, 0);
  };
}

interface EventHeatmapViewProps {
  matches: ScoredEvent[];
  filters: SearchFilters;
  loading: boolean;
  isFavorite: (eventId: string) => boolean;
  onToggleFavorite: (match: ScoredEvent) => void;
  onSelectEvent: (match: ScoredEvent) => void;
  onChangeLocation: (lat: number, lon: number) => void;
}

const QUICK_CITIES = [
  { name: 'Milano', lat: 45.4642, lon: 9.1900 },
  { name: 'Bari', lat: 41.1171, lon: 16.8719 },
  { name: 'Roma', lat: 41.9028, lon: 12.4964 },
  { name: 'Bologna', lat: 44.4949, lon: 11.3426 },
];

export const EventHeatmapView: React.FC<EventHeatmapViewProps> = ({
  matches,
  filters,
  loading,
  isFavorite,
  onToggleFavorite,
  onSelectEvent,
  onChangeLocation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const heatLayerRef = useRef<ThermalCanvasLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);

  const [heatMode, setHeatMode] = useState<'score' | 'density'>('score');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  const selectedMatch = useMemo(
    () => matches.find((m) => m.event.id === selectedMatchId) || null,
    [matches, selectedMatchId]
  );

  // Compute heat points according to selected mode
  const heatPoints = useMemo<HeatPoint[]>(() => {
    return matches
      .filter((m) => m.event.venue.lat !== 0 && m.event.venue.lon !== 0)
      .map((m) => ({
        lat: m.event.venue.lat,
        lon: m.event.venue.lon,
        intensity: heatMode === 'score' ? Math.max(0.25, m.score / 100) : 0.65,
      }));
  }, [matches, heatMode]);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [filters.lat, filters.lon],
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Dark OLED tiles: optional MapTiler Dark if VITE_MAPTILER_API_KEY is set, otherwise free CartoDB DarkMatter (no key needed)
    const mapTilerKey = import.meta.env.VITE_MAPTILER_API_KEY as string | undefined;
    const tileUrl =
      mapTilerKey && !mapTilerKey.startsWith('your_')
        ? `https://api.maptiler.com/maps/dataviz-dark/256/{z}/{x}/{y}.png?key=${mapTilerKey}`
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

    L.tileLayer(tileUrl, {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(map);

    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 120);

    const heatLayer = new ThermalCanvasLayer([]);
    heatLayer.addTo(map);

    const userGroup = L.layerGroup().addTo(map);
    const markersGroup = L.layerGroup().addTo(map);

    map.on('click', () => {
      setSelectedMatchId(null);
    });

    mapInstanceRef.current = map;
    heatLayerRef.current = heatLayer;
    userLayerRef.current = userGroup;
    markersLayerRef.current = markersGroup;

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapInstanceRef.current = null;
      heatLayerRef.current = null;
      userLayerRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  // Update center, user radius perimeter & heatmap points when data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const heatLayer = heatLayerRef.current;
    const userLayer = userLayerRef.current;
    const markersLayer = markersLayerRef.current;

    if (!map || !heatLayer || !userLayer || !markersLayer) return;

    // 1. Update Heat Layer
    heatLayer.setPoints(heatPoints);

    // 2. Update User Position & Search Perimeter R_max
    userLayer.clearLayers();
    L.circle([filters.lat, filters.lon], {
      radius: filters.radiusKm * 1000,
      color: '#6bb8d9',
      weight: 1.5,
      opacity: 0.35,
      dashArray: '6 6',
      fillColor: '#6bb8d9',
      fillOpacity: 0.02,
      interactive: false,
    }).addTo(userLayer);

    const userDotIcon = L.divIcon({
      className: 'eventspot-user-pin',
      html: `<div style="width:16px;height:16px;border-radius:9999px;background:#6bb8d9;border:3px solid #06131a;box-shadow:0 0 14px rgba(107,184,217,0.9);"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    L.marker([filters.lat, filters.lon], { icon: userDotIcon, interactive: false }).addTo(userLayer);

    // 3. Update Interactive Event Markers
    markersLayer.clearLayers();
    matches.forEach((m) => {
      const { lat, lon } = m.event.venue;
      if (!lat || !lon) return;

      const isSelected = m.event.id === selectedMatchId;
      const bg = isSelected ? '#6bb8d9' : 'rgba(19, 20, 23, 0.92)';
      const fg = isSelected ? '#06131a' : '#ffffff';
      const border = isSelected ? '#ffffff' : 'rgba(107, 184, 217, 0.65)';
      const scale = isSelected ? 'transform:scale(1.12);' : '';

      const pinIcon = L.divIcon({
        className: 'eventspot-event-pin',
        html: `<div style="display:inline-flex;align-items:center;justify-content:center;padding:4px 9px;border-radius:9999px;background:${bg};color:${fg};border:1.5px solid ${border};font-weight:800;font-size:11px;font-family:'Plus Jakarta Sans',sans-serif;box-shadow:0 4px 14px rgba(0,0,0,0.65);white-space:nowrap;cursor:pointer;${scale}">${m.score}%</div>`,
        iconSize: [44, 24],
        iconAnchor: [22, 12],
      });

      const marker = L.marker([lat, lon], { icon: pinIcon });
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedMatchId(m.event.id);
        map.panTo([lat, lon], { animate: true });
      });
      marker.addTo(markersLayer);
    });
  }, [matches, heatPoints, filters.lat, filters.lon, filters.radiusKm, selectedMatchId]);

  // Smooth pan when city center changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setView([filters.lat, filters.lon], filters.radiusKm >= 100 ? 10 : 12, {
      animate: true,
    });
  }, [filters.lat, filters.lon]);

  const handleFitEvents = () => {
    const map = mapInstanceRef.current;
    if (!map || matches.length === 0) return;

    const coords: [number, number][] = matches
      .filter((m) => m.event.venue.lat && m.event.venue.lon)
      .map((m) => [m.event.venue.lat, m.event.venue.lon]);
    coords.push([filters.lat, filters.lon]);

    if (coords.length > 0) {
      map.fitBounds(L.latLngBounds(coords), { padding: [50, 50], maxZoom: 13 });
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      onChangeLocation(
        Math.round(pos.coords.latitude * 10000) / 10000,
        Math.round(pos.coords.longitude * 10000) / 10000
      );
    });
  };

  return (
    <div className="space-y-4">
      {/* Header & Heatmap Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Mappa termica <span className="text-accent-primary">live</span>
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
            Intensità calcolata su score Context-Driven, raggio {filters.radiusKm} km e prossimità venue.
          </p>
        </div>

        {/* Segmented Control (iOS style) */}
        <div className="inline-flex p-1 rounded-full bg-card border border-border-subtle self-start sm:self-auto">
          <button
            onClick={() => setHeatMode('score')}
            className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              heatMode === 'score'
                ? 'bg-accent-primary text-on-accent font-bold shadow-subtle'
                : 'text-text-secondary hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Affinità Match</span>
          </button>
          <button
            onClick={() => setHeatMode('density')}
            className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              heatMode === 'density'
                ? 'bg-accent-primary text-on-accent font-bold shadow-subtle'
                : 'text-text-secondary hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Densità Eventi</span>
          </button>
        </div>
      </div>

      {/* Interactive Map Stage */}
      <div className="relative w-full h-[62vh] min-h-[430px] max-h-[680px] rounded-3xl overflow-hidden border border-border-subtle shadow-popover bg-[#08090b]">
        {/* Top Floating Controls over Map */}
        <div className="absolute top-3 left-3 right-3 z-[350] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
            <button
              onClick={handleLocateMe}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-full bg-card/90 hover:bg-card backdrop-blur-xl border border-white/10 text-xs font-semibold text-white shadow-subtle"
            >
              <Navigation className="w-3.5 h-3.5 text-accent-primary" />
              <span>GPS</span>
            </button>

            {QUICK_CITIES.map((city) => {
              const active =
                Math.abs(filters.lat - city.lat) < 0.05 &&
                Math.abs(filters.lon - city.lon) < 0.05;
              return (
                <button
                  key={city.name}
                  onClick={() => onChangeLocation(city.lat, city.lon)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-xl border transition-colors ${
                    active
                      ? 'bg-accent-primary text-on-accent border-accent-primary font-bold'
                      : 'bg-card/85 text-text-secondary hover:text-white border-white/10'
                  }`}
                >
                  {city.name}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleFitEvents}
            disabled={matches.length === 0}
            className="pointer-events-auto inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-card/90 hover:bg-card backdrop-blur-xl border border-white/10 text-xs font-semibold text-white shadow-subtle disabled:opacity-40"
          >
            <Maximize2 className="w-3.5 h-3.5 text-accent-primary" />
            <span>Adatta eventi ({matches.length})</span>
          </button>
        </div>

        {/* Leaflet Container */}
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Loading Shimmer Overlay */}
        {loading && (
          <div className="absolute inset-0 z-[360] bg-black/45 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
            <div className="px-4 py-2 rounded-full bg-card border border-border-active text-xs font-semibold text-accent-primary shadow-popover">
              Aggiornamento mappa termica...
            </div>
          </div>
        )}

        {/* Thermal Legend Pill (Bottom Left) */}
        {!selectedMatch && (
          <div className="absolute bottom-4 left-3 z-[350] bg-card/90 backdrop-blur-xl border border-white/10 rounded-2xl px-3.5 py-2.5 text-[11px] space-y-1.5 shadow-card pointer-events-auto">
            <div className="flex items-center justify-between gap-4 font-semibold text-white">
              <span>{heatMode === 'score' ? 'Calore Match' : 'Densità Live'}</span>
              <span className="text-text-muted">{matches.length} venue</span>
            </div>
            <div className="w-36 h-2 rounded-full bg-gradient-to-r from-[#1e3a8a] via-[#6bb8d9] via-[#f59e0b] to-[#ef4444]" />
            <div className="flex justify-between text-[10px] text-text-muted">
              <span>Bassa</span>
              <span>Media</span>
              <span>Hotspot</span>
            </div>
          </div>
        )}

        {/* Floating Bottom Event Sheet when Marker Clicked */}
        {selectedMatch && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-[390px] z-[400] bg-card/95 backdrop-blur-2xl border border-white/15 rounded-2xl p-4 shadow-popover space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center space-x-3 min-w-0">
                <img
                  src={
                    selectedMatch.event.imageUrl ||
                    'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=80'
                  }
                  alt={selectedMatch.event.name}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=80';
                  }}
                  className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-card-subtle"
                />
                <div className="min-w-0">
                  <div className="flex items-center space-x-2 mb-0.5">
                    <span className="px-2 py-0.5 rounded-full bg-accent-primary text-on-accent text-[11px] font-extrabold">
                      {selectedMatch.score}/100
                    </span>
                    <span className="text-[11px] text-text-muted flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-accent-primary" />
                      <span>{selectedMatch.distanceKm} km</span>
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white truncate">
                    {selectedMatch.event.name}
                  </h4>
                  <p className="text-xs text-text-secondary truncate">
                    {selectedMatch.event.venue.name}, {selectedMatch.event.venue.city}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedMatchId(null)}
                className="p-1 rounded-full bg-card-subtle text-text-muted hover:text-white flex-shrink-0"
                aria-label="Chiudi anteprima"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-secondary">
              <span className="inline-flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-accent-primary" />
                <span>
                  {new Date(selectedMatch.event.startDateTime).toLocaleDateString('it-IT', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </span>
              <span className="inline-flex items-center space-x-1">
                {selectedMatch.event.venue.isOutdoor ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-accent-amber" />
                    <span>Outdoor</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-accent-primary" />
                    <span>Indoor</span>
                  </>
                )}
              </span>
            </div>

            <p className="text-xs text-text-secondary line-clamp-2 bg-card-subtle rounded-xl px-3 py-2">
              {selectedMatch.naturalLanguageReason}
            </p>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                onClick={() => onToggleFavorite(selectedMatch)}
                className={`p-2 rounded-full border transition-colors ${
                  isFavorite(selectedMatch.event.id)
                    ? 'bg-accent-rose border-accent-rose text-white'
                    : 'bg-card-subtle border-border-subtle text-white hover:border-border-active'
                }`}
                aria-label="Preferito"
              >
                <Heart
                  className={`w-4 h-4 ${isFavorite(selectedMatch.event.id) ? 'fill-current' : ''}`}
                />
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onSelectEvent(selectedMatch)}
                  className="px-3.5 py-1.5 rounded-full bg-card-subtle hover:bg-[#25282e] border border-border-subtle text-xs font-semibold text-white"
                >
                  Dettagli
                </button>
                <a
                  href={selectedMatch.event.ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 px-4 py-1.5 rounded-full bg-accent-primary hover:bg-accent-primary-hover text-on-accent font-bold text-xs"
                >
                  <span>Biglietti</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
