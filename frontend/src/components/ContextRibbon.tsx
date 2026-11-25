import React from 'react';
import {
  CloudRain,
  Sun,
  Clock,
  Radio,
  AlertTriangle,
  Zap,
  Compass,
  Flame,
} from 'lucide-react';
import { MatchesResponse } from '@eventspot/shared';

interface ContextRibbonProps {
  data?: MatchesResponse | null;
  loading: boolean;
  onOpenHeatmap?: () => void;
}

export const ContextRibbon: React.FC<ContextRibbonProps> = ({
  data,
  loading,
  onOpenHeatmap,
}) => {
  if (loading && !data) {
    return (
      <div className="bg-card border border-border-subtle rounded-2xl p-5 animate-pulse">
        <div className="h-4 bg-card-subtle rounded w-1/4 mb-3" />
        <div className="h-6 bg-card-subtle rounded w-3/4" />
      </div>
    );
  }

  if (!data) return null;

  const isFallback = data.meta.scoringMode === 'spatio_temporal_fallback';
  const weather = data.contextSummary.weather;
  const timeSlot = data.contextSummary.timeSlot;
  const sessionTags = data.contextSummary.sessionTags || [];

  const dayNames = [
    'Domenica',
    'Lunedì',
    'Martedì',
    'Mercoledì',
    'Giovedì',
    'Venerdì',
    'Sabato',
  ];
  const dayName = dayNames[timeSlot.dayOfWeek] || 'Oggi';

  return (
    <section className="bg-card border border-border-subtle rounded-2xl p-4 sm:p-5 shadow-card">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Mode & Telemetry */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                isFallback
                  ? 'bg-accent-amber/15 text-accent-amber border border-accent-amber/30'
                  : 'bg-accent-lime/15 text-accent-lime border border-accent-lime/30'
              }`}
            >
              {isFallback ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Fallback spazio-temporale</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Context-Driven attivo</span>
                </>
              )}
            </span>

            {data.meta.isEventsCacheStale && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-card-subtle text-text-muted border border-border-subtle">
                Cache resiliente attiva
              </span>
            )}

            <span className="text-xs text-text-muted">
              {data.meta.totalMatches} eventi in {data.meta.responseTimeMs} ms
            </span>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-white">
            Stato contestuale rilevato
          </h2>
        </div>

        {/* Right: Sensors */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
          {/* Weather */}
          <div className="bg-card-subtle border border-border-subtle rounded-xl p-2.5 flex items-center space-x-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                weather.isAdverse
                  ? 'bg-accent-rose/15 text-accent-rose'
                  : 'bg-accent-lime/15 text-accent-lime'
              }`}
            >
              {weather.isAdverse ? (
                <CloudRain className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-white truncate">
                {weather.tempC}°C {weather.description}
              </div>
              <div className="text-text-muted truncate">
                {weather.isAdverse ? 'Pioggia o vento' : 'Meteo favorevole'}
              </div>
            </div>
          </div>

          {/* Time Slot */}
          <div className="bg-card-subtle border border-border-subtle rounded-xl p-2.5 flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-sky/15 text-accent-sky flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-white truncate">
                {dayName} {timeSlot.hourOfDay.toString().padStart(2, '0')}:00
              </div>
              <div className="text-text-muted truncate">
                {timeSlot.isWeekend ? 'Weekend' : 'Infrasettimanale'}
                {timeSlot.isEvening ? ' serale' : ''}
              </div>
            </div>
          </div>

          {/* Spatial Scope + Heatmap shortcut */}
          <div className="col-span-2 sm:col-span-1 bg-card-subtle border border-border-subtle rounded-xl p-2.5 flex items-center justify-between space-x-2">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-accent-emerald/15 text-accent-emerald flex items-center justify-center flex-shrink-0">
                <Compass className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-white truncate">
                  Raggio {data.meta.searchContext.radiusKm} km
                </div>
                <div className="text-text-muted truncate">
                  {data.meta.searchContext.lat.toFixed(2)}, {data.meta.searchContext.lon.toFixed(2)}
                </div>
              </div>
            </div>

            {onOpenHeatmap && (
              <button
                onClick={onOpenHeatmap}
                className="p-2 rounded-lg bg-accent-lime/15 hover:bg-accent-lime text-accent-lime hover:text-on-lime transition-colors flex-shrink-0"
                title="Apri mappa termica"
                aria-label="Apri mappa termica"
              >
                <Flame className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Session Musical Footprint */}
      <div className="mt-4 pt-3.5 border-t border-border-subtle flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-muted flex items-center space-x-1.5 font-medium mr-1">
          <Radio className="w-3.5 h-3.5 text-accent-lime" />
          <span>Sessione recente:</span>
        </span>

        {sessionTags.length > 0 ? (
          sessionTags.slice(0, 6).map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-card-subtle text-text-primary text-xs border border-border-subtle"
            >
              <span className="font-medium">{tag.name}</span>
              <span className="text-accent-lime font-mono text-[10px]">
                {(tag.weight * 100).toFixed(0)}%
              </span>
            </span>
          ))
        ) : (
          <span className="text-xs text-text-muted">
            Nessun ascolto Spotify recente rilevato — ranking guidato da distanza, orario e meteo.
          </span>
        )}
      </div>
    </section>
  );
};
