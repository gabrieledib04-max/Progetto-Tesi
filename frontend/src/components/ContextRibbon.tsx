import React from 'react';
import {
  CloudRain,
  Sun,
  Clock,
  Radio,
  AlertTriangle,
  Zap,
  Compass,
} from 'lucide-react';
import { MatchesResponse } from '@eventspot/shared';

interface ContextRibbonProps {
  data?: MatchesResponse | null;
  loading: boolean;
}

export const ContextRibbon: React.FC<ContextRibbonProps> = ({ data, loading }) => {
  if (loading && !data) {
    return (
      <div className="bg-card/60 border border-border-subtle rounded-2xl p-4 animate-pulse">
        <div className="h-4 bg-card-subtle rounded w-1/4 mb-2" />
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
    <section className="bg-gradient-to-r from-card via-surface-elevated to-card border border-border-subtle rounded-2xl p-4 sm:p-5 shadow-card transition-all">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Context State & Scoring Mode */}
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2.5">
            <span
              className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isFallback
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30'
              }`}
            >
              {isFallback ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Modalità fallback (Missing Context)</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Modalità Context-Driven attiva</span>
                </>
              )}
            </span>

            {data.meta.isEventsCacheStale && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-card-subtle text-text-muted border border-border-subtle">
                Cache resiliente (stale-if-error)
              </span>
            )}

            <span className="text-xs text-text-muted hidden sm:inline">
              Calcolato in {data.meta.responseTimeMs} ms · {data.meta.totalMatches} eventi trovati
            </span>
          </div>

          <h2 className="text-base sm:text-lg font-semibold text-white flex items-center space-x-2">
            <span>Stato contestuale rilevato per la raccomandazione</span>
          </h2>
        </div>

        {/* Right: Detected contextual sensors */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs">
          {/* Weather Chip */}
          <div className="bg-card-subtle/80 border border-border-subtle rounded-xl p-2.5 flex items-center space-x-2.5">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                weather.isAdverse
                  ? 'bg-accent-rose/15 text-accent-rose'
                  : 'bg-accent-amber/15 text-accent-amber'
              }`}
            >
              {weather.isAdverse ? (
                <CloudRain className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="font-medium text-white">
                {weather.tempC}°C · {weather.description}
              </div>
              <div className="text-text-muted">
                {weather.isAdverse ? 'Precipitazioni attive' : 'Meteo sereno/favorevole'}
              </div>
            </div>
          </div>

          {/* Time Slot Chip */}
          <div className="bg-card-subtle/80 border border-border-subtle rounded-xl p-2.5 flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent-sky/15 text-accent-sky flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="font-medium text-white">
                {dayName}, ore {timeSlot.hourOfDay.toString().padStart(2, '0')}:00
              </div>
              <div className="text-text-muted">
                {timeSlot.isWeekend ? 'Fascia weekend' : 'Fascia infrasettimanale'}{' '}
                {timeSlot.isEvening ? '· Sera' : ''}
              </div>
            </div>
          </div>

          {/* Spatial Scope Chip */}
          <div className="col-span-2 sm:col-span-1 bg-card-subtle/80 border border-border-subtle rounded-xl p-2.5 flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent-emerald/15 text-accent-emerald flex items-center justify-center">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="font-medium text-white">
                Raggio: {data.meta.searchContext.radiusKm} km
              </div>
              <div className="text-text-muted">
                GPS: {data.meta.searchContext.lat.toFixed(2)}, {data.meta.searchContext.lon.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Session Musical Footprint */}
      <div className="mt-3.5 pt-3 border-t border-border-subtle flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-muted flex items-center space-x-1.5 font-medium mr-1">
          <Radio className="w-3.5 h-3.5 text-accent-amber" />
          <span>Generi attivi nella sessione recente:</span>
        </span>

        {sessionTags.length > 0 ? (
          sessionTags.slice(0, 6).map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-card-subtle text-text-primary text-xs border border-border-subtle"
            >
              <span className="font-medium">{tag.name}</span>
              <span className="text-accent-amber/80 font-mono text-[10px]">
                ({(tag.weight * 100).toFixed(0)}%)
              </span>
            </span>
          ))
        ) : (
          <span className="text-xs text-text-muted italic">
            Nessun ascolto recente su Spotify rilevato. Attivato il ranking basato esclusivamente su coordinate e orario.
          </span>
        )}
      </div>
    </section>
  );
};
