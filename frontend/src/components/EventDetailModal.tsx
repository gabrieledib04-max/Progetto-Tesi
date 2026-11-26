import React, { useEffect } from 'react';
import { X, Calendar, MapPin, ExternalLink, ShieldCheck, Sun, Heart, Euro, Sparkles } from 'lucide-react';
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-card border border-border-active rounded-3xl shadow-popover overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Image */}
        <div className="relative aspect-[21/9] w-full bg-card-subtle overflow-hidden">
          <img
            src={
              event.imageUrl ||
              'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=80'
            }
            alt={event.name}
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=80';
            }}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-black/55" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/70 hover:bg-black text-white border border-white/10 transition-colors"
            aria-label="Chiudi dettagli"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-3 left-5">
            <span className="px-3.5 py-1.5 rounded-full bg-accent-primary text-on-accent font-extrabold text-xs sm:text-sm shadow-accent">
              {score}/100 Match contestuale
            </span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
              {event.name}
            </h2>
            {event.artistNames && event.artistNames.length > 0 && (
              <p className="text-text-secondary text-sm mt-1">
                Artisti: {event.artistNames.join(', ')}
              </p>
            )}
          </div>

          {/* Explainability */}
          <div className="bg-card-subtle rounded-2xl p-4 space-y-1.5 border border-border-subtle">
            <h4 className="text-xs font-bold text-accent-primary flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Perché ti viene raccomandato</span>
            </h4>
            <p className="text-text-secondary leading-relaxed text-xs sm:text-sm">
              {naturalLanguageReason}
            </p>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="bg-card-subtle p-3.5 rounded-2xl border border-border-subtle flex items-start space-x-3">
              <Calendar className="w-5 h-5 text-accent-primary flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-xs text-text-muted block">Data e orario</span>
                <span className="font-bold text-white capitalize block">{dateFormatted}</span>
                <span className="text-xs text-text-secondary">Inizio alle ore {timeFormatted}</span>
              </div>
            </div>

            <div className="bg-card-subtle p-3.5 rounded-2xl border border-border-subtle flex items-start space-x-3">
              <MapPin className="w-5 h-5 text-accent-primary flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-xs text-text-muted block">Luogo e distanza</span>
                <span className="font-bold text-white block">{event.venue.name}</span>
                <span className="text-xs text-text-secondary">
                  {event.venue.city} ({distanceKm} km da te)
                </span>
              </div>
            </div>

            <div className="bg-card-subtle p-3.5 rounded-2xl border border-border-subtle flex items-start space-x-3">
              {event.venue.isOutdoor ? (
                <Sun className="w-5 h-5 text-accent-amber flex-shrink-0 mt-0.5" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-accent-primary flex-shrink-0 mt-0.5" />
              )}
              <div>
                <span className="text-xs text-text-muted block">Tipologia venue</span>
                <span className="font-bold text-white block">
                  {event.venue.isOutdoor ? "All'aperto (Outdoor)" : 'Al chiuso (Indoor)'}
                </span>
                <span className="text-xs text-text-secondary">
                  {event.venue.isOutdoor ? 'Esposto alle condizioni meteo' : 'Protetto da pioggia e vento'}
                </span>
              </div>
            </div>

            <div className="bg-card-subtle p-3.5 rounded-2xl border border-border-subtle flex items-start space-x-3">
              <Euro className="w-5 h-5 text-accent-primary flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-xs text-text-muted block">Biglietto d'ingresso</span>
                <span className="font-bold text-white block">
                  {event.priceRange
                    ? `${event.priceRange.min} - ${event.priceRange.max} ${event.priceRange.currency === 'EUR' ? '€' : event.priceRange.currency}`
                    : 'Prezzo su Ticketmaster'}
                </span>
                <span className="text-xs text-text-secondary">Biglietteria ufficiale</span>
              </div>
            </div>
          </div>

          {event.genres && event.genres.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs text-text-muted block">Generi associati</span>
              <div className="flex flex-wrap gap-1.5">
                {event.genres.map((g, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full bg-card-subtle border border-border-subtle text-xs text-text-secondary font-medium"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="p-4 sm:p-5 border-t border-border-subtle bg-surface flex items-center justify-between">
          <button
            onClick={onToggleFavorite}
            className={`px-4 py-2.5 rounded-full border text-xs font-semibold flex items-center space-x-2 transition-colors ${
              isFavorite
                ? 'bg-accent-rose text-white border-accent-rose'
                : 'bg-card-subtle text-white border-border-subtle hover:border-border-active'
            }`}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            <span>{isFavorite ? 'Salvato' : 'Salva'}</span>
          </button>

          <a
            href={event.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2.5 rounded-full bg-accent-primary hover:bg-accent-primary-hover text-on-accent font-bold text-xs sm:text-sm flex items-center space-x-2 shadow-accent transition-colors"
          >
            <span>Acquista su Ticketmaster</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
};
