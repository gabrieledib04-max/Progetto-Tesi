import React, { useState } from 'react';
import {
  SlidersHorizontal,
  MapPin,
  Calendar,
  Euro,
  ArrowUpDown,
  Navigation,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SearchFilters } from '../api/client.js';

interface FilterControlsProps {
  filters: SearchFilters;
  onChange: (updated: Partial<SearchFilters>) => void;
  onSubmit: () => void;
  loading: boolean;
}

export const FilterControls: React.FC<FilterControlsProps> = ({
  filters,
  onChange,
  onSubmit,
  loading,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocalizzazione non supportata dal tuo browser');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        onChange({
          lat: Math.round(pos.coords.latitude * 10000) / 10000,
          lon: Math.round(pos.coords.longitude * 10000) / 10000,
        });
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err.message);
        alert('Impossibile ottenere la posizione GPS: ' + err.message);
      },
      { timeout: 8000 }
    );
  };

  const setCityPreset = (lat: number, lon: number) => {
    onChange({ lat, lon });
  };

  return (
    <div className="bg-card border border-border-subtle rounded-2xl p-4 sm:p-5 shadow-card space-y-4">
      {/* Top Main Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Location & Radius Summary */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-card-subtle border border-border-subtle text-xs text-text-primary">
            <MapPin className="w-3.5 h-3.5 text-accent-amber" />
            <span className="font-medium">
              {filters.lat.toFixed(2)}, {filters.lon.toFixed(2)}
            </span>
          </div>

          <button
            onClick={handleGetLocation}
            disabled={isLocating}
            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-card-subtle hover:bg-card-subtle/80 border border-border-subtle hover:border-accent-amber/40 text-xs text-text-secondary hover:text-white transition-colors"
            title="Rileva posizione GPS corrente dal browser"
          >
            <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Rilevamento...' : 'Mio GPS'}</span>
          </button>

          {/* Quick City Presets */}
          <div className="hidden md:flex items-center space-x-1 text-xs text-text-muted">
            <span className="mr-1">Città:</span>
            <button
              onClick={() => setCityPreset(45.4642, 9.1900)}
              className="px-2 py-0.5 rounded-md hover:bg-card-subtle hover:text-white"
            >
              Milano
            </button>
            <button
              onClick={() => setCityPreset(41.9028, 12.4964)}
              className="px-2 py-0.5 rounded-md hover:bg-card-subtle hover:text-white"
            >
              Roma
            </button>
            <button
              onClick={() => setCityPreset(44.4949, 11.3426)}
              className="px-2 py-0.5 rounded-md hover:bg-card-subtle hover:text-white"
            >
              Bologna
            </button>
            <button
              onClick={() => setCityPreset(45.0703, 7.6869)}
              className="px-2 py-0.5 rounded-md hover:bg-card-subtle hover:text-white"
            >
              Torino
            </button>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Sorting Dropdown */}
          <div className="flex items-center space-x-1.5 bg-card-subtle px-2.5 py-1.5 rounded-xl border border-border-subtle text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-text-muted" />
            <select
              value={filters.sortBy}
              onChange={(e) =>
                onChange({
                  sortBy: e.target.value as 'relevance' | 'date' | 'distance' | 'price',
                })
              }
              className="bg-transparent text-text-primary focus:outline-none cursor-pointer"
            >
              <option value="relevance" className="bg-card text-white">
                Rilevanza contestuale
              </option>
              <option value="date" className="bg-card text-white">
                Data concerto
              </option>
              <option value="distance" className="bg-card text-white">
                Distanza da me
              </option>
              <option value="price" className="bg-card text-white">
                Prezzo crescente
              </option>
            </select>
          </div>

          {/* Toggle Expand Details */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-card-subtle hover:bg-card-subtle/80 border border-border-subtle text-xs text-text-secondary hover:text-white transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filtri</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 ml-1" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 ml-1" />
            )}
          </button>

          {/* Search Trigger */}
          <button
            onClick={onSubmit}
            disabled={loading}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-accent-amber hover:bg-amber-400 text-slate-950 font-semibold text-xs shadow-subtle transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Aggiorna</span>
          </button>
        </div>
      </div>

      {/* Expanded Filter Panel */}
      {isExpanded && (
        <div className="pt-3 border-t border-border-subtle grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs animate-in fade-in duration-150">
          {/* Radius Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-text-secondary font-medium">
              <span className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-accent-amber" />
                <span>Raggio di ricerca</span>
              </span>
              <span className="font-semibold text-white">{filters.radiusKm} km</span>
            </div>
            <input
              type="range"
              min="10"
              max="200"
              step="5"
              value={filters.radiusKm}
              onChange={(e) => onChange({ radiusKm: parseInt(e.target.value, 10) })}
              className="w-full accent-accent-amber bg-card-subtle rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-text-muted">
              <span>10 km</span>
              <span>50 km</span>
              <span>100 km</span>
              <span>200 km</span>
            </div>
          </div>

          {/* Budget Filter */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-text-secondary font-medium">
              <span className="flex items-center space-x-1">
                <Euro className="w-3.5 h-3.5 text-accent-emerald" />
                <span>Budget massimo</span>
              </span>
              <span className="font-semibold text-white">
                {filters.maxPrice ? `${filters.maxPrice} €` : 'Illimitato'}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              {[undefined, 25, 40, 60, 100].map((presetVal, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onChange({ maxPrice: presetVal })}
                  className={`px-2 py-1 rounded-lg border text-xs ${
                    filters.maxPrice === presetVal
                      ? 'bg-accent-emerald/20 text-accent-emerald border-accent-emerald/40 font-semibold'
                      : 'bg-card-subtle text-text-secondary border-border-subtle hover:text-white'
                  }`}
                >
                  {presetVal ? `${presetVal}€` : 'Tutti'}
                </button>
              ))}
            </div>
            <label className="flex items-center space-x-1.5 pt-1 text-[11px] text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={filters.includeUnpriced}
                onChange={(e) => onChange({ includeUnpriced: e.target.checked })}
                className="accent-accent-amber rounded"
              />
              <span>Includi eventi senza prezzo su Ticketmaster</span>
            </label>
          </div>

          {/* Date Window */}
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center space-x-1 text-text-secondary font-medium">
              <Calendar className="w-3.5 h-3.5 text-accent-sky" />
              <span>Finestra temporale</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-text-muted block mb-0.5">Da data:</label>
                <input
                  type="date"
                  value={filters.dateFrom?.slice(0, 10) || ''}
                  onChange={(e) =>
                    onChange({
                      dateFrom: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                    })
                  }
                  className="w-full bg-card-subtle border border-border-subtle rounded-lg px-2 py-1 text-text-primary text-xs focus:outline-none focus:border-accent-amber"
                />
              </div>
              <div>
                <label className="text-[10px] text-text-muted block mb-0.5">A data:</label>
                <input
                  type="date"
                  value={filters.dateTo?.slice(0, 10) || ''}
                  onChange={(e) =>
                    onChange({
                      dateTo: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                    })
                  }
                  className="w-full bg-card-subtle border border-border-subtle rounded-lg px-2 py-1 text-text-primary text-xs focus:outline-none focus:border-accent-amber"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
