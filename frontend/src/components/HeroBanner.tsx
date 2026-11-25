import React from 'react';
import { Music, Sparkles } from 'lucide-react';

interface HeroBannerProps {
  isAuthenticated: boolean;
  onSpotifyLogin: () => void;
  onMockLogin: () => void;
  loading: boolean;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  isAuthenticated,
  onSpotifyLogin,
  onMockLogin,
  loading,
}) => {
  if (isAuthenticated) {
    return (
      <section className="pt-1 pb-1">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
          Live scelti <span className="text-accent-lime">per te</span>
        </h1>
      </section>
    );
  }

  return (
    <section className="space-y-5 pt-2">
      <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-none">
        Ciao <span className="text-accent-lime">ascoltatore?</span>
      </h1>

      <div className="bg-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-card space-y-4">
        <div className="space-y-1.5 max-w-2xl">
          <h2 className="text-base sm:text-lg font-bold text-white">
            Accedi per vedere gli eventi scelti per te
          </h2>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            Collega Spotify (solo sessione recente, zero storico salvato) oppure avvia la modalità demo per abbinare ciò che stai ascoltando alla tua posizione, orario e meteo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={onSpotifyLogin}
            disabled={loading}
            className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-full bg-accent-lime hover:bg-accent-lime-hover text-on-lime font-bold text-xs sm:text-sm shadow-lime disabled:opacity-50"
          >
            <Music className="w-4 h-4 stroke-[2.5]" />
            <span>Accedi con Spotify</span>
          </button>

          <button
            onClick={onMockLogin}
            disabled={loading}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full bg-card-subtle hover:bg-[#25282e] border border-border-active text-white font-semibold text-xs sm:text-sm disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent-lime" />
            <span>Prova Demo 1-Click</span>
          </button>
        </div>
      </div>
    </section>
  );
};
