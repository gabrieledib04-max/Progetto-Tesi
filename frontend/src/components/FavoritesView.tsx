import React from 'react';
import { Heart, Trash2, Calendar, MapPin, ExternalLink, ShieldCheck } from 'lucide-react';
import { FavoriteSnapshot } from '@eventspot/shared';

interface FavoritesViewProps {
  favorites: FavoriteSnapshot[];
  onRemoveFavorite: (eventId: string) => void;
  onExploreMatches: () => void;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  favorites,
  onRemoveFavorite,
  onExploreMatches,
}) => {
  const now = new Date().getTime();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          I tuoi <span className="text-accent-lime">preferiti</span>
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
          Concerti salvati localmente sul dispositivo tramite Local-First Privacy-by-Design.
        </p>
      </div>

      {favorites.length === 0 ? (
        <div className="bg-card border border-border-subtle rounded-2xl p-8 sm:p-12 text-center space-y-4 max-w-xl mx-auto shadow-card">
          <div className="w-14 h-14 rounded-2xl bg-card-subtle border border-border-subtle text-accent-rose flex items-center justify-center mx-auto">
            <Heart className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white">Nessun concerto salvato</h3>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            Gli eventi che salvi vengono memorizzati unicamente nel tuo browser, senza alcun tracciamento o database remoto.
          </p>
          <button
            onClick={onExploreMatches}
            className="px-6 py-2.5 rounded-full bg-accent-lime hover:bg-accent-lime-hover text-on-lime font-bold text-xs sm:text-sm shadow-lime transition-colors"
          >
            Esplora eventi per te
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-card border border-border-subtle rounded-2xl p-3.5 sm:p-4 flex items-start space-x-3 text-xs">
            <ShieldCheck className="w-4 h-4 text-accent-lime flex-shrink-0 mt-0.5" />
            <p className="text-text-secondary leading-relaxed">
              <strong className="text-white">Archiviazione Local-First: </strong>
              Questa lista risiede esclusivamente nel <code className="font-mono text-accent-lime">localStorage</code> di questo dispositivo e non viene mai inviata ai server.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {favorites.map((fav) => {
              const eventTime = new Date(fav.startDateTime).getTime();
              const isPast = eventTime < now;
              const eventDate = new Date(fav.startDateTime);
              const dateStr = eventDate.toLocaleDateString('it-IT', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              });

              return (
                <article
                  key={fav.eventId}
                  className={`bg-card border rounded-2xl overflow-hidden shadow-card flex flex-col justify-between transition-colors ${
                    isPast ? 'border-border-subtle opacity-65' : 'border-border-subtle hover:border-border-active'
                  }`}
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-card-subtle">
                    <img
                      src={
                        fav.imageUrl ||
                        'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=80'
                      }
                      alt={fav.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-black/35" />

                    {isPast && (
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/80 text-accent-rose text-[10px] font-bold">
                        Evento concluso
                      </div>
                    )}

                    <button
                      onClick={() => onRemoveFavorite(fav.eventId)}
                      className="absolute top-3 right-3 p-2 rounded-full bg-black/65 hover:bg-accent-rose text-white/85 hover:text-white transition-colors"
                      title="Rimuovi dai preferiti"
                      aria-label="Rimuovi dai preferiti"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center space-x-1.5 text-xs text-text-secondary mb-1.5">
                        <Calendar className="w-3.5 h-3.5 text-accent-lime" />
                        <span className="capitalize font-medium">{dateStr}</span>
                      </div>

                      <h4 className="text-base font-bold text-white leading-snug line-clamp-2">
                        {fav.name}
                      </h4>

                      <p className="text-xs text-text-muted mt-1 flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-accent-lime flex-shrink-0" />
                        <span>
                          {fav.venue}, {fav.city}
                        </span>
                      </p>
                    </div>

                    <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
                      <span className="text-xs text-text-secondary font-medium">
                        {fav.priceRange
                          ? `Da ${fav.priceRange.min} ${fav.priceRange.currency === 'EUR' ? '€' : fav.priceRange.currency}`
                          : 'Prezzo su Ticketmaster'}
                      </span>

                      <a
                        href={fav.ticketUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 px-4 py-1.5 rounded-full text-xs font-bold bg-accent-lime hover:bg-accent-lime-hover text-on-lime transition-colors"
                      >
                        <span>Biglietti</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
