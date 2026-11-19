import React, { useState } from 'react';
import {
  Calendar,
  MapPin,
  Heart,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Sun,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ScoredEvent } from '@eventspot/shared';

interface EventCardProps {
  match: ScoredEvent;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onSelectEvent: () => void;
}

export const EventCard: React.FC<EventCardProps> = ({
  match,
  isFavorite,
  onToggleFavorite,
  onSelectEvent,
}) => {
  const [showSubScores, setShowSubScores] = useState(false);
  const { event, score, subScores, naturalLanguageReason, distanceKm } = match;

  // Format date in Italian locale
  const eventDate = new Date(event.startDateTime);
  const dateFormatted = eventDate.toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const timeFormatted = eventDate.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Score badge style
  const getScoreColor = (val: number) => {
    if (val >= 85) return 'text-accent-amber border-accent-amber/40 bg-accent-amber/10';
    if (val >= 70) return 'text-accent-emerald border-accent-emerald/40 bg-accent-emerald/10';
    return 'text-accent-sky border-accent-sky/40 bg-accent-sky/10';
  };

  return (
    <article className="group bg-card hover:bg-surface-elevated border border-border-subtle hover:border-border-active rounded-2xl overflow-hidden shadow-card transition-all flex flex-col justify-between">
      {/* Media and Badges Header */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-card-subtle">
        <img
          src={event.imageUrl || 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=80'}
          alt={event.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=80';
          }}
        />

        {/* Gradient overlay for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-black/40" />

        {/* Score Dial / Badge */}
        <div className="absolute top-3 left-3 flex items-center space-x-1.5">
          <div
            className={`px-2.5 py-1 rounded-xl text-xs font-bold border backdrop-blur-md shadow-subtle ${getScoreColor(
              score
            )}`}
          >
            <span className="text-sm">{score}</span>
            <span className="text-[10px] font-normal opacity-80">/100 match</span>
          </div>
        </div>

        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={`absolute top-3 right-3 p-2 rounded-xl backdrop-blur-md transition-colors ${
            isFavorite
              ? 'bg-accent-rose text-white shadow-subtle'
              : 'bg-black/50 hover:bg-black/70 text-white/80 hover:text-white'
          }`}
          title={isFavorite ? 'Rimuovi dai preferiti' : 'Salva nei preferiti'}
          aria-label="Salva nei preferiti"
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>

        {/* Venue Type & Weather badge on image bottom */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-xs text-white/90">
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm">
            {event.venue.isOutdoor ? (
              <>
                <Sun className="w-3 h-3 text-accent-amber" />
                <span>Outdoor</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3 h-3 text-accent-emerald" />
                <span>Indoor coperto</span>
              </>
            )}
          </span>

          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm">
            <MapPin className="w-3 h-3 text-accent-sky" />
            <span>{distanceKm} km</span>
          </span>
        </div>
      </div>

      {/* Card Content Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3.5">
        <div>
          {/* Date & Time */}
          <div className="flex items-center space-x-2 text-xs text-text-muted mb-1.5">
            <Calendar className="w-3.5 h-3.5 text-accent-amber" />
            <span className="capitalize font-medium text-text-secondary">
              {dateFormatted} · ore {timeFormatted}
            </span>
          </div>

          {/* Event Title */}
          <h3
            onClick={onSelectEvent}
            className="text-base sm:text-lg font-semibold text-white leading-snug line-clamp-2 hover:text-accent-amber cursor-pointer transition-colors"
          >
            {event.name}
          </h3>

          {/* Line-up Artists */}
          {event.artistNames && event.artistNames.length > 0 && (
            <p className="text-xs text-text-secondary mt-1 line-clamp-1">
              {event.artistNames.join(', ')}
            </p>
          )}

          {/* Venue & City */}
          <p className="text-xs text-text-muted mt-1 flex items-center space-x-1">
            <span>
              {event.venue.name}, {event.venue.city}
            </span>
          </p>
        </div>

        {/* White-box Explainability Ribbon (FR-08) */}
        <div className="bg-card-subtle/80 border border-border-subtle rounded-xl p-3 text-xs space-y-1">
          <div className="flex items-center space-x-1.5 text-accent-amber font-medium text-[11px]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Perché ti viene raccomandato:</span>
          </div>
          <p className="text-text-secondary leading-relaxed line-clamp-2">
            {naturalLanguageReason}
          </p>
        </div>

        {/* Expandable Sub-scores details */}
        <div>
          <button
            onClick={() => setShowSubScores(!showSubScores)}
            className="w-full flex items-center justify-between text-[11px] text-text-muted hover:text-text-secondary py-1 transition-colors"
          >
            <span>Dettaglio sub-score contestuali</span>
            {showSubScores ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showSubScores && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] bg-card-subtle p-2.5 rounded-xl border border-border-subtle animate-in fade-in">
              <div className="flex justify-between">
                <span className="text-text-muted">Sim. Semantica:</span>
                <span className="font-mono text-white">
                  {(subScores.semanticSim * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Congr. Tempo:</span>
                <span className="font-mono text-white">
                  {(subScores.timeCongruence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Decad. Spaziale:</span>
                <span className="font-mono text-white">
                  {(subScores.spatialDecay * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Compat. Meteo:</span>
                <span className="font-mono text-white">
                  {(subScores.weatherCompatibility * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions & Price */}
        <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
          <div className="text-xs">
            {event.priceRange ? (
              <div>
                <span className="text-text-muted">Da </span>
                <span className="text-sm font-semibold text-white">
                  {event.priceRange.min} {event.priceRange.currency || '€'}
                </span>
              </div>
            ) : (
              <span className="text-text-muted text-[11px]">Prezzo su Ticketmaster</span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onSelectEvent}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-text-secondary hover:text-white bg-card-subtle hover:bg-card border border-border-subtle transition-colors"
            >
              Dettagli
            </button>
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-accent-amber hover:bg-amber-400 text-slate-950 transition-colors shadow-subtle"
            >
              <span>Biglietti</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
};
