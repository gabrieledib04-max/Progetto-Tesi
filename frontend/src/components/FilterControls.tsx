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
  onChange: (updated: Partial<SearchFilters>, autoFetch?: boolean) => void;
  onSubmit: () => void;
  loading: boolean;
}

const CITY_PRESETS = [
  { name: 'Milano', lat: 45.4642, lon: 9.1900 },
  { name: 'Bari', lat: 41.1171, lon: 16.8719 },
  { name: 'Roma', lat: 41.9028, lon: 12.4964 },
  { name: 'Bologna', lat: 44.4949, lon: 11.3426 },
  { name: 'Torino', lat: 45.0703, lon: 7.6869 },
];

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
        onChange(
          {
            lat: Math.round(pos.coords.latitude * 10000) / 10000,
            lon: Math.round(pos.coords.longitude * 10000) / 10000,
          },
          true
        );
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err.message);
        alert('Impossibile ottenere la posizione GPS: ' + err.message);
      },
      { timeout: 8000 }
    );
  };

  return (
    <div className="bg-card border border-border-subtle rounded-2xl p-4 sm:p-5 shadow-card space-y-4">
      {/* Top Main Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Location & Quick City Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleGetLocation}
            disabled={isLocating}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-card-subtle hover:bg-[#25282e] border border-border-subtle hover:border-accent-lime/50 text-xs font-medium text-white transition-colors"
            title="Rileva posizione GPS corrente dal browser"
          >
            <Navigation className={`w-3.5 h-3.5 text-accent-lime ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Rilevamento...' : 'Mio GPS'}</span>
          </button>

          <div className="flex flex-wrap items-center gap-1 text-xs">
            {CITY_PRESETS.map((city) => {
              const isSelected =
                Math.abs(filters.lat - city.lat) < 0.05 &&
                Math.abs(filters.lon - city.lon) < 0.05;
              return (
                <button
                  key={city.name}
                  type="button"
                  onClick={() => onChange({ lat: city.lat, lon: city.lon }, true)}
                  className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
                    isSelected
                      ? 'bg-accent-lime text-on-lime font-bold shadow-subtle'
                      : 'bg-card-subtle text-text-secondary hover:text-white border border-border-subtle'
                  }`}
                >
                  {city.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sorting Dropdown */}
          <div className="flex items-center space-x-1.5 bg-card-subtle px-3 py-1.5 rounded-full border border-border-subtle text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-accent-lime" />
            <select
              value={filters.sortBy}
              onChange={(e) =>
                onChange(
                  {
                    sortBy: e.target.value as 'relevance' | 'date' | 'distance' | 'price',
                  },
                  true
                )
              }
              aria-label="Ordina risultati"
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
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
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full border text-xs font-medium transition-colors ${
              isExpanded
                ? 'bg-white/10 border-border-active text-white'
                : 'bg-card-subtle border-border-subtle text-text-secondary hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filtri</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Search CTA Pill */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-full bg-accent-lime hover:bg-accent-lime-hover text-on-lime font-bold text-xs shadow-lime disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Aggiorna</span>
          </button>
        </div>
      </div>

      {/* Expanded Filter Panel */}
      {isExpanded && (
        <div className="pt-4 border-t border-border-subtle grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
          {/* Radius Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-text-secondary font-medium">
              <span className="flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-accent-lime" />
                <span>Raggio di ricerca</span>
              </span>
              <span className="font-bold text-white">{filters.radiusKm} km</span>
            </div>
            <input
              type="range"
              min="10"
              max="200"
              step="5"
              value={filters.radiusKm}
              onChange={(e) => onChange({ radiusKm: parseInt(e.target.value, 10) })}
              className="w-full accent-[#c2ff00] bg-card-subtle rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-text-muted">
              <span>10 km</span>
              <span>50 km</span>
              <span>100 km</span>
              <span>200 km</span>
            </div>
          </div>

          {/* Budget Filter */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-text-secondary font-medium">
              <span className="flex items-center space-x-1.5">
                <Euro className="w-3.5 h-3.5 text-accent-lime" />
                <span>Budget massimo</span>
              </span>
              <span className="font-bold text-white">
                {filters.maxPrice ? `${filters.maxPrice} €` : 'Illimitato'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {[undefined, 25, 40, 60, 100].map((presetVal, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onChange({ maxPrice: presetVal }, true)}
                  className={`px-3 py-1 rounded-full border text-xs font-medium ${
                    filters.maxPrice === presetVal
                      ? 'bg-accent-lime text-on-lime border-accent-lime font-bold'
                      : 'bg-card-subtle text-text-secondary border-border-subtle hover:text-white'
                  }`}
                >
                  {presetVal ? `${presetVal}€` : 'Tutti'}
                </button>
              ))}
            </div>
            <label className="flex items-center space-x-2 pt-1 text-[11px] text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={filters.includeUnpriced}
                onChange={(e) => onChange({ includeUnpriced: e.target.checked }, true)}
                className="accent-[#c2ff00] rounded"
              />
              <span>Includi eventi senza prezzo su Ticketmaster</span>
            </label>
          </div>

          {/* Date Window */}
          <div className="space-y-2 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center space-x-1.5 text-text-secondary font-medium">
              <Calendar className="w-3.5 h-3.5 text-accent-sky" />
              <span>Finestra temporale</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-text-muted block mb-1">Da data</label>
                <input
                  type="date"
                  value={filters.dateFrom?.slice(0, 10) || ''}
                  onChange={(e) =>
                    onChange({
                      dateFrom: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                    })
                  }
                  className="w-full bg-card-subtle border border-border-subtle rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-accent-lime"
                />
              </div>
              <div>
                <label className="text-[11px] text-text-muted block mb-1">A data</label>
                <input
                  type="date"
                  value={filters.dateTo?.slice(0, 10) || ''}
                  onChange={(e) =>
                    onChange({
                      dateTo: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                    })
                  }
                  className="w-full bg-card-subtle border border-border-subtle rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-accent-lime"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
