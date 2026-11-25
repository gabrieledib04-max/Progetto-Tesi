import React from 'react';
import {
  Music,
  Sparkles,
  LogOut,
  Trash2,
  ShieldCheck,
  Lock,
  Radio,
  MapPin,
} from 'lucide-react';
import { MatchesResponse } from '@eventspot/shared';
import { SessionInfo, SearchFilters } from '../api/client.js';

interface AccountViewProps {
  session: SessionInfo;
  matchesData: MatchesResponse | null;
  filters: SearchFilters;
  loading: boolean;
  onSpotifyLogin: () => void;
  onMockLogin: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  onOpenPrivacyTab: () => void;
}

export const AccountView: React.FC<AccountViewProps> = ({
  session,
  matchesData,
  filters,
  loading,
  onSpotifyLogin,
  onMockLogin,
  onLogout,
  onDeleteAccount,
  onOpenPrivacyTab,
}) => {
  const sessionTags = matchesData?.contextSummary.sessionTags || [];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Il tuo <span className="text-accent-lime">account</span>
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
          Sessione effimera Spotify, contesto di ascolto attivo e controllo Privacy GDPR.
        </p>
      </div>

      {/* Session & Auth Card */}
      <section className="bg-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  session.authenticated ? 'bg-accent-lime' : 'bg-text-muted'
                }`}
              />
              <h2 className="text-base sm:text-lg font-bold text-white">
                {session.authenticated ? 'Sessione attiva' : 'Nessun account connesso'}
              </h2>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              {session.authenticated
                ? 'Connesso con scope limitato agli ultimi brani riprodotti. I token sono cifrati a riposo con AES-256-GCM e scadono automaticamente.'
                : 'Attualmente stai navigando in modalità Fallback Spazio-Temporale. Accedi per attivare l\'affinità musicale dalla tua sessione.'}
            </p>
          </div>

          {!session.authenticated && (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={onSpotifyLogin}
                disabled={loading}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full bg-accent-lime hover:bg-accent-lime-hover text-on-lime font-bold text-xs shadow-lime disabled:opacity-50"
              >
                <Music className="w-4 h-4 stroke-[2.5]" />
                <span>Connetti Spotify</span>
              </button>
              <button
                onClick={onMockLogin}
                disabled={loading}
                className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-full bg-card-subtle hover:bg-[#25282e] border border-border-active text-white font-semibold text-xs disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-accent-lime" />
                <span>Demo 1-Click</span>
              </button>
            </div>
          )}
        </div>

        {session.authenticated && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-card-subtle rounded-xl p-3.5 border border-border-subtle space-y-1">
                <span className="text-text-muted flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-accent-lime" />
                  <span>Identificativo pseudonimizzato</span>
                </span>
                <p className="font-mono text-white font-semibold truncate">
                  {session.userHash || 'mock_session_hash'}
                </p>
              </div>

              <div className="bg-card-subtle rounded-xl p-3.5 border border-border-subtle space-y-1">
                <span className="text-text-muted flex items-center space-x-1.5">
                  <Lock className="w-3.5 h-3.5 text-accent-emerald" />
                  <span>Politica di conservazione</span>
                </span>
                <p className="text-white font-semibold">
                  TTL automatico 24 ore (Zero storico DB)
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle">
              <button
                onClick={onOpenPrivacyTab}
                className="text-xs text-text-secondary hover:text-accent-lime underline underline-offset-4 transition-colors"
              >
                Leggi dettagli Privacy-by-Design
              </button>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={onLogout}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full bg-card-subtle hover:bg-[#25282e] border border-border-subtle text-xs font-semibold text-white transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnetti</span>
                </button>

                <button
                  onClick={onDeleteAccount}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full bg-accent-rose/15 hover:bg-accent-rose text-accent-rose hover:text-white border border-accent-rose/30 text-xs font-bold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Dimenticami (GDPR)</span>
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Active Musical Footprint & Context Parameters */}
      <section className="bg-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold text-white flex items-center space-x-2">
            <Radio className="w-4 h-4 text-accent-lime" />
            <span>Vettore generi della sessione corrente</span>
          </h3>
          <span className="text-xs text-text-muted font-mono">
            lambda = 0.15
          </span>
        </div>

        {sessionTags.length > 0 ? (
          <div className="space-y-2.5">
            {sessionTags.slice(0, 8).map((tag, i) => (
              <div key={i} className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="font-medium text-white capitalize">{tag.name}</span>
                  <span className="font-mono text-accent-lime font-semibold">
                    {(tag.weight * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-card-subtle overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent-lime"
                    style={{ width: `${Math.min(100, Math.round(tag.weight * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-muted leading-relaxed">
            Nessun vettore di generi attivo in questa sessione. Connetti Spotify o attiva la Demo 1-Click per popolare la sessione recente.
          </p>
        )}

        <div className="pt-3 border-t border-border-subtle flex items-center justify-between text-xs text-text-muted">
          <span className="flex items-center space-x-1.5">
            <MapPin className="w-3.5 h-3.5 text-accent-lime" />
            <span>
              Coordinate correnti: {filters.lat.toFixed(4)}, {filters.lon.toFixed(4)}
            </span>
          </span>
          <span>Raggio: {filters.radiusKm} km</span>
        </div>
      </section>
    </div>
  );
};
