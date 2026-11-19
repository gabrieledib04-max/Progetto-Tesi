import React from 'react';
import { Music, Radio, Shield, Heart, Sparkles, LogOut, Trash2 } from 'lucide-react';
import { SessionInfo } from '../api/client.js';

interface HeaderProps {
  session: SessionInfo;
  activeTab: 'matches' | 'favorites';
  onTabChange: (tab: 'matches' | 'favorites') => void;
  favoritesCount: number;
  onSpotifyLogin: () => void;
  onMockLogin: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  onOpenPrivacyModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  session,
  activeTab,
  onTabChange,
  favoritesCount,
  onSpotifyLogin,
  onMockLogin,
  onLogout,
  onDeleteAccount,
  onOpenPrivacyModal,
}) => {
  return (
    <header className="border-b border-border-subtle bg-surface/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-accent-amber/15 border border-accent-amber/30 flex items-center justify-center text-accent-amber shadow-subtle">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-white">EventSpot</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent-amber/20 text-accent-amber border border-accent-amber/30 font-medium">
                  Context-Driven
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                Sistema di raccomandazione concerti basato su sessione, posizione e meteo
              </p>
            </div>
          </div>

          {/* Mobile Privacy Info Button */}
          <button
            onClick={onOpenPrivacyModal}
            className="md:hidden p-2 text-text-secondary hover:text-white rounded-lg hover:bg-card-subtle"
            title="Architettura & Privacy"
            aria-label="Info privacy e architettura"
          >
            <Shield className="w-5 h-5" />
          </button>
        </div>

        {/* Center Navigation Tabs */}
        <nav className="flex items-center space-x-1.5 bg-card p-1 rounded-xl border border-border-subtle self-start md:self-auto">
          <button
            onClick={() => onTabChange('matches')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
              activeTab === 'matches'
                ? 'bg-accent-amber text-slate-950 font-semibold shadow-subtle'
                : 'text-text-secondary hover:text-white hover:bg-card-subtle'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>Esplora match</span>
          </button>
          <button
            onClick={() => onTabChange('favorites')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
              activeTab === 'favorites'
                ? 'bg-accent-amber text-slate-950 font-semibold shadow-subtle'
                : 'text-text-secondary hover:text-white hover:bg-card-subtle'
            }`}
          >
            <Heart className="w-4 h-4" />
            <span>I miei preferiti</span>
            {favoritesCount > 0 && (
              <span
                className={`text-xs px-1.5 py-0.2 rounded-full ${
                  activeTab === 'favorites'
                    ? 'bg-slate-950/20 text-slate-950 font-bold'
                    : 'bg-accent-amber/20 text-accent-amber'
                }`}
              >
                {favoritesCount}
              </span>
            )}
          </button>
        </nav>

        {/* Auth / Session Control Section */}
        <div className="flex items-center space-x-2.5 self-end md:self-auto">
          <button
            onClick={onOpenPrivacyModal}
            className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-white bg-card rounded-lg border border-border-subtle hover:border-border-active transition-colors"
          >
            <Shield className="w-3.5 h-3.5 text-accent-emerald" />
            <span>Privacy-by-Design</span>
          </button>

          {session.authenticated ? (
            <div className="flex items-center space-x-2">
              <div
                className="flex items-center space-x-2 px-3 py-1.5 bg-card rounded-lg border border-border-subtle"
                title={`Pseudonimo sessione: ${session.userHash}`}
              >
                <div className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" />
                <span className="text-xs font-mono text-text-secondary max-w-[110px] truncate">
                  {session.userHash?.slice(0, 10)}...
                </span>
              </div>
              <button
                onClick={onDeleteAccount}
                className="p-1.5 text-text-muted hover:text-accent-rose hover:bg-accent-rose/10 rounded-lg border border-transparent hover:border-accent-rose/30 transition-colors"
                title="Dimenticami (cancellazione GDPR immediata dei dati effimeri)"
                aria-label="Cancellazione GDPR"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={onLogout}
                className="p-1.5 text-text-muted hover:text-white hover:bg-card-subtle rounded-lg border border-transparent hover:border-border-subtle transition-colors"
                title="Disconnetti"
                aria-label="Disconnetti"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={onMockLogin}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-white bg-card-subtle hover:bg-card rounded-lg border border-border-subtle hover:border-accent-amber/40 transition-colors shadow-subtle"
                title="Accesso rapido con sessione demo senza credenziali Spotify"
              >
                <Sparkles className="w-3.5 h-3.5 text-accent-amber" />
                <span>Demo 1-click</span>
              </button>
              <button
                onClick={onSpotifyLogin}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-[#1db954] hover:bg-[#1aa34a] rounded-lg shadow-subtle transition-colors"
                title="Connetti il tuo account Spotify tramite OAuth 2.0 PKCE"
              >
                <Music className="w-3.5 h-3.5" />
                <span>Accedi Spotify</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
