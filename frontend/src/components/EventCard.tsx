import React, { useState } from 'react';
import {
  Calendar,
  MapPin,
  Heart,
  ExternalLink,
  ChevronDown,
  ChevronUp,
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

  const getScoreBadge = (val: number) => {
    if (val >= 85) {
      return 'bg-accent-primary text-on-accent font-extrabold shadow-accent';
    }
    if (val >= 70) {
      return 'bg-card/90 text-accent-primary border border-accent-primary/40 font-bold backdrop-blur-md';
    }
    return 'bg-card/90 text-white border border-border-active font-bold backdrop-blur-md';
  };

  return (
    <article className="group bg-card hover:bg-surface-elevated border border-border-subtle hover:border-border-active rounded-2xl overflow-hidden shadow-card flex flex-col justify-between transition-colors">
      {/* Media Header */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-card-subtle">
        <img
          src={
            event.imageUrl ||
            'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=80'
          }
          alt={event.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=80';
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-card via-black/15 to-black/45" />

        {/* Score Pill */}
        <div className="absolute top-3 left-3">
          <div className={`px-3 py-1 rounded-full text-xs flex items-baseline space-x-1 ${getScoreBadge(score)}`}>
            <span className="text-sm leading-none">{score}</span>
            <span className="text-[10px] font-medium opacity-80">/100 match</span>
          </div>
        </div>

        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-colors ${
            isFavorite
              ? 'bg-accent-rose text-white shadow-subtle'
              : 'bg-black/60 hover:bg-black/80 text-white/85 hover:text-white border border-white/10'
          }`}
          title={isFavorite ? 'Rimuovi dai preferiti' : 'Salva nei preferiti'}
          aria-label="Salva nei preferiti"
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>

        {/* Indoor/Outdoor & Distance Pills */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10">
            {event.venue.isOutdoor ? (
              <>
                <Sun className="w-3.5 h-3.5 text-accent-amber" />
                <span>Outdoor</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-accent-primary" />
                <span>Indoor coperto</span>
              </>
            )}
          </span>

          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10">
            <MapPin className="w-3.5 h-3.5 text-accent-primary" />
            <span>{distanceKm} km</span>
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-text-secondary mb-1.5">
            <Calendar className="w-3.5 h-3.5 text-accent-primary flex-shrink-0" />
            <span className="capitalize font-medium">{dateFormatted}</span>
            <span className="text-text-muted">alle {timeFormatted}</span>
          </div>

          <h3
            onClick={onSelectEvent}
            className="text-base sm:text-lg font-bold text-white leading-snug line-clamp-2 hover:text-accent-primary cursor-pointer transition-colors"
          >
            {event.name}
          </h3>

          {event.artistNames && event.artistNames.length > 0 && (
            <p className="text-xs text-text-secondary mt-1 line-clamp-1">
              {event.artistNames.join(', ')}
            </p>
          )}

          <p className="text-xs text-text-muted mt-1">
            {event.venue.name}, {event.venue.city}
          </p>
        </div>

        {/* White-box Explainability */}
        <div className="bg-card-subtle rounded-xl p-3 text-xs space-y-1">
          <div className="flex items-center space-x-1.5 text-accent-primary font-semibold text-[11px]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Perché questo match</span>
          </div>
          <p className="text-text-secondary leading-relaxed line-clamp-2">
            {naturalLanguageReason}
          </p>
        </div>

        {/* Sub-scores Accordion */}
        <div>
          <button
            onClick={() => setShowSubScores(!showSubScores)}
            className="w-full flex items-center justify-between text-[11px] text-text-muted hover:text-white py-1 transition-colors"
          >
            <span>Scomposizione score contestuale</span>
            {showSubScores ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showSubScores && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] bg-card-subtle p-3 rounded-xl">
              <div className="flex justify-between">
                <span className="text-text-muted">Semantica</span>
                <span className="font-mono font-semibold text-accent-primary">
                  {(subScores.semanticSim * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Tempo</span>
                <span className="font-mono font-semibold text-white">
                  {(subScores.timeCongruence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Spazio</span>
                <span className="font-mono font-semibold text-white">
                  {(subScores.spatialDecay * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Meteo</span>
                <span className="font-mono font-semibold text-white">
                  {(subScores.weatherCompatibility * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-border-subtle flex items-center justify-between gap-2">
          <div className="text-xs">
            {event.priceRange ? (
              <div>
                <span className="text-text-muted">Da </span>
                <span className="text-sm font-bold text-white">
                  {event.priceRange.min} {event.priceRange.currency === 'EUR' ? '€' : event.priceRange.currency}
                </span>
              </div>
            ) : (
              <span className="text-text-muted text-[11px]">Prezzo su Ticketmaster</span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onSelectEvent}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-white bg-card-subtle hover:bg-[#25282e] border border-border-subtle transition-colors"
            >
              Dettagli
            </button>
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 px-4 py-1.5 rounded-full text-xs font-bold bg-accent-primary hover:bg-accent-primary-hover text-on-accent shadow-subtle transition-colors"
            >
              <span>Biglietti</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
};
