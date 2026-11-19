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

  if (favorites.length === 0) {
    return (
      <div className="bg-card border border-border-subtle rounded-2xl p-8 sm:p-12 text-center space-y-4 max-w-xl mx-auto shadow-card">
        <div className="w-14 h-14 rounded-2xl bg-accent-rose/10 border border-accent-rose/20 text-accent-rose flex items-center justify-center mx-auto shadow-subtle">
          <Heart className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-semibold text-white">Nessun evento salvato nei preferiti</h3>
        <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
          I concerti che salvi vengono memorizzati esclusivamente nella memoria del tuo browser
          (Privacy-by-Design), senza tracciamento o profilazione su server remoti.
        </p>
        <button
          onClick={onExploreMatches}
          className="px-5 py-2.5 rounded-xl bg-accent-amber hover:bg-amber-400 text-slate-950 font-semibold text-xs sm:text-sm shadow-subtle transition-colors"
        >
          Esplora eventi raccomandati
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Privacy Notice Banner */}
      <div className="bg-card-subtle/80 border border-border-subtle rounded-xl p-3 sm:p-4 flex items-start space-x-3 text-xs">
        <ShieldCheck className="w-4 h-4 text-accent-emerald flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white">Archiviazione Local-First protetta: </span>
          <span className="text-text-secondary">
            Questa lista è conservata unicamente nel <code className="font-mono text-accent-amber">localStorage</code> del tuo browser. Se cancelli i dati di navigazione o esegui la richiesta GDPR, la lista non sarà recuperabile perché non risiede su alcun server.
          </span>
        </div>
      </div>

      {/* Grid of Favorites */}
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
            <div
              key={fav.eventId}
              className={`bg-card border rounded-2xl overflow-hidden shadow-card transition-all flex flex-col justify-between ${
                isPast ? 'border-border-subtle/60 opacity-70' : 'border-border-subtle hover:border-border-active'
              }`}
            >
              {/* Image banner */}
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-card-subtle">
                <img
                  src={fav.imageUrl || 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=80'}
                  alt={fav.name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-black/30" />

                {isPast && (
                  <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-black/80 text-accent-rose text-[10px] font-semibold">
                    Evento concluso
                  </div>
                )}

                <button
                  onClick={() => onRemoveFavorite(fav.eventId)}
                  className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-accent-rose text-white/80 hover:text-white transition-colors"
                  title="Rimuovi dai preferiti"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Details */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center space-x-1.5 text-xs text-text-muted mb-1">
                    <Calendar className="w-3.5 h-3.5 text-accent-amber" />
                    <span className="capitalize">{dateStr}</span>
                  </div>

                  <h4 className="text-base font-semibold text-white leading-snug line-clamp-2">
                    {fav.name}
                  </h4>

                  <p className="text-xs text-text-secondary mt-1 flex items-center space-x-1">
                    <MapPin className="w-3 h-3 text-text-muted" />
                    <span>
                      {fav.venue}, {fav.city}
                    </span>
                  </p>
                </div>

                <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
                  <span className="text-xs text-text-secondary">
                    {fav.priceRange
                      ? `Da ${fav.priceRange.min} ${fav.priceRange.currency || '€'}`
                      : 'Prezzo su Ticketmaster'}
                  </span>

                  <a
                    href={fav.ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-accent-amber hover:bg-amber-400 text-slate-950 transition-colors shadow-subtle"
                  >
                    <span>Biglietti</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
