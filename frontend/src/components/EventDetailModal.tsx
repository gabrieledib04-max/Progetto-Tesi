import React, { useEffect } from 'react';
import { X, Calendar, MapPin, ExternalLink, ShieldCheck, Sun, Heart, Euro } from 'lucide-react';
import { ScoredEvent } from '@eventspot/shared';

interface EventDetailModalProps {
  match: ScoredEvent | null;
  isOpen: boolean;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  match,
  isOpen,
  onClose,
  isFavorite,
  onToggleFavorite,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !match) return null;

  const { event, score, distanceKm, naturalLanguageReason } = match;
  const eventDate = new Date(event.startDateTime);
  const dateFormatted = eventDate.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeFormatted = eventDate.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl bg-card border border-border-subtle rounded-3xl shadow-popover overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header Media */}
        <div className="relative aspect-[21/9] w-full bg-card-subtle overflow-hidden">
          <img
            src={event.imageUrl || 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=80'}
            alt={event.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-black/50" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white transition-colors"
            aria-label="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Score Badge */}
          <div className="absolute bottom-3 left-5">
            <span className="px-3 py-1 rounded-xl bg-accent-amber text-slate-950 font-bold text-sm shadow-subtle">
              {score}/100 Match Contestuale
            </span>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">
              {event.name}
            </h2>
            {event.artistNames && event.artistNames.length > 0 && (
              <p className="text-text-secondary text-sm mt-1">
                Artisti: {event.artistNames.join(', ')}
              </p>
            )}
          </div>

          {/* Why Recommended Callout */}
          <div className="bg-card-subtle/80 border border-border-subtle rounded-2xl p-4 space-y-1">
            <h4 className="text-xs font-semibold text-accent-amber uppercase tracking-wider">
              Motivazione della Raccomandazione:
            </h4>
            <p className="text-text-secondary leading-relaxed text-xs sm:text-sm">
              {naturalLanguageReason}
            </p>
          </div>

          {/* Event Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* When */}
            <div className="bg-card-subtle/50 p-3.5 rounded-2xl border border-border-subtle flex items-start space-x-3">
              <Calendar className="w-5 h-5 text-accent-amber flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-xs text-text-muted block">Data e orario</span>
                <span className="font-semibold text-white capitalize block">{dateFormatted}</span>
                <span className="text-xs text-text-secondary">Inizio live alle ore {timeFormatted}</span>
              </div>
            </div>

            {/* Where */}
            <div className="bg-card-subtle/50 p-3.5 rounded-2xl border border-border-subtle flex items-start space-x-3">
              <MapPin className="w-5 h-5 text-accent-sky flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-xs text-text-muted block">Luogo & Distanza</span>
                <span className="font-semibold text-white block">{event.venue.name}</span>
                <span className="text-xs text-text-secondary">
                  {event.venue.city} ({distanceKm} km da te)
                </span>
              </div>
            </div>

            {/* Venue Type */}
            <div className="bg-card-subtle/50 p-3.5 rounded-2xl border border-border-subtle flex items-start space-x-3">
              {event.venue.isOutdoor ? (
                <Sun className="w-5 h-5 text-accent-amber flex-shrink-0 mt-0.5" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-accent-emerald flex-shrink-0 mt-0.5" />
              )}
              <div>
                <span className="text-xs text-text-muted block">Tipologia Venue</span>
                <span className="font-semibold text-white block">
                  {event.venue.isOutdoor ? 'Concerto all\'aperto (Outdoor)' : 'Club o Palazzetto al chiuso (Indoor)'}
                </span>
                <span className="text-xs text-text-secondary">
                  {event.venue.isOutdoor ? 'Soggetto a condizioni meteo' : 'Protetto da pioggia e maltempo'}
                </span>
              </div>
            </div>

            {/* Price */}
            <div className="bg-card-subtle/50 p-3.5 rounded-2xl border border-border-subtle flex items-start space-x-3">
              <Euro className="w-5 h-5 text-accent-emerald flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-xs text-text-muted block">Biglietto d'ingresso</span>
                <span className="font-semibold text-white block">
                  {event.priceRange
                    ? `${event.priceRange.min} - ${event.priceRange.max} ${event.priceRange.currency || '€'}`
                    : 'Prezzo su Ticketmaster'}
                </span>
                <span className="text-xs text-text-secondary">
                  Venditore ufficiale autorizzato
                </span>
              </div>
            </div>
          </div>

          {/* Genres Tags */}
          {event.genres && event.genres.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs text-text-muted block">Classificazioni e Generi:</span>
              <div className="flex flex-wrap gap-1.5">
                {event.genres.map((g, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-card-subtle border border-border-subtle text-xs text-text-secondary font-medium"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer CTA */}
        <div className="p-4 sm:p-5 border-t border-border-subtle bg-surface flex items-center justify-between">
          <button
            onClick={onToggleFavorite}
            className={`px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center space-x-2 transition-colors ${
              isFavorite
                ? 'bg-accent-rose text-white border-accent-rose'
                : 'bg-card text-text-secondary border-border-subtle hover:text-white'
            }`}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            <span>{isFavorite ? 'Salvato tra i preferiti' : 'Salva nei preferiti'}</span>
          </button>

          <a
            href={event.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2.5 rounded-xl bg-accent-amber hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center space-x-2 transition-colors shadow-subtle"
          >
            <span>Acquista su Ticketmaster</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
};
