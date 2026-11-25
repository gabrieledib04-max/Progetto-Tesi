import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.js';
import { HeroBanner } from './components/HeroBanner.js';
import { IPhoneTabBar, AppTab } from './components/IPhoneTabBar.js';
import { ContextRibbon } from './components/ContextRibbon.js';
import { FilterControls } from './components/FilterControls.js';
import { EventCard } from './components/EventCard.js';
import { EventHeatmapView } from './components/EventHeatmapView.js';
import { FavoritesView } from './components/FavoritesView.js';
import { AccountView } from './components/AccountView.js';
import { EventDetailModal } from './components/EventDetailModal.js';
import { LegalModal, LegalTab } from './components/LegalModal.js';
import { Footer } from './components/Footer.js';
import { apiClient, SearchFilters, SessionInfo } from './api/client.js';
import { useFavorites } from './hooks/useFavorites.js';
import { MatchesResponse, ScoredEvent } from '@eventspot/shared';
import { AlertCircle, Music } from 'lucide-react';

export function App() {
  const [session, setSession] = useState<SessionInfo>({ authenticated: false });
  const [activeTab, setActiveTab] = useState<AppTab>('matches');
  const [matchesData, setMatchesData] = useState<MatchesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedEvent, setSelectedEvent] = useState<ScoredEvent | null>(null);
  const [legalModalOpen, setLegalModalOpen] = useState<boolean>(false);
  const [legalTab, setLegalTab] = useState<LegalTab>('privacy');

  // Default coordinates: Milan (45.4642, 9.1900)
  const [filters, setFilters] = useState<SearchFilters>({
    lat: 45.4642,
    lon: 9.1900,
    radiusKm: 50,
    sortBy: 'relevance',
    includeUnpriced: true,
  });

  const { favorites, isFavorite, toggleFavorite, removeFavorite, totalFavorites } = useFavorites();

  const checkSession = useCallback(async () => {
    try {
      const sess = await apiClient.getSession();
      setSession(sess);
    } catch {
      setSession({ authenticated: false });
    }
  }, []);

  const loadMatches = useCallback(async (currentFilters: SearchFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getMatches(currentFilters);
      setMatchesData(data);
    } catch (err: any) {
      console.error('Failed to load matches:', err);
      setError(err.message || 'Errore durante il recupero dei concerti consigliati');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth_success') === 'true') {
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('auth_error')) {
      setError(`Autenticazione fallita: ${urlParams.get('auth_error')}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    checkSession();
    loadMatches(filters);
  }, []);

  const handleSpotifyLogin = () => {
    window.location.href = '/v1/auth/login';
  };

  const handleMockLogin = async () => {
    try {
      setLoading(true);
      await apiClient.mockLogin();
      await checkSession();
      await loadMatches(filters);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.logout();
      await checkSession();
      await loadMatches(filters);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Vuoi cancellare immediatamente e in modo irreversibile tutti i dati effimeri della tua sessione (Diritto all\'Oblio GDPR)?'
    );
    if (!confirmed) return;

    try {
      await apiClient.deleteAccount();
      await checkSession();
      await loadMatches(filters);
      alert('Sessione e chiavi effimere cancellate con successo.');
    } catch (err: any) {
      alert(`Errore cancellazione: ${err.message}`);
    }
  };

  const handleFilterChange = (updated: Partial<SearchFilters>, autoFetch = false) => {
    setFilters((prev) => {
      const next = { ...prev, ...updated };
      if (autoFetch) {
        loadMatches(next);
      }
      return next;
    });
  };

  const handleFilterSubmit = () => {
    loadMatches(filters);
  };

  const handleOpenLegal = (tab: LegalTab) => {
    setLegalTab(tab);
    setLegalModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-canvas text-text-primary flex flex-col justify-between selection:bg-accent-lime selection:text-on-lime">
      {/* Minimal Top Bar */}
      <Header
        session={session}
        onGoToAccount={() => setActiveTab('account')}
        onGoHome={() => setActiveTab('matches')}
      />

      {/* Main Content Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {activeTab === 'matches' && (
          <>
            <HeroBanner
              isAuthenticated={session.authenticated}
              onSpotifyLogin={handleSpotifyLogin}
              onMockLogin={handleMockLogin}
              loading={loading}
            />

            <ContextRibbon
              data={matchesData}
              loading={loading}
              onOpenHeatmap={() => setActiveTab('map')}
            />

            <FilterControls
              filters={filters}
              onChange={handleFilterChange}
              onSubmit={handleFilterSubmit}
              loading={loading}
            />

            {error && (
              <div className="bg-accent-rose/10 border border-accent-rose/30 text-accent-rose rounded-2xl p-4 flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  onClick={() => loadMatches(filters)}
                  className="px-4 py-1.5 bg-accent-rose/20 hover:bg-accent-rose/30 rounded-full font-semibold transition-colors"
                >
                  Riprova
                </button>
              </div>
            )}

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
                  <Music className="w-4 h-4 text-accent-lime" />
                  <span>Concerti ed eventi selezionati</span>
                </h3>
                {matchesData && !loading && (
                  <span className="text-xs text-text-muted">
                    {matchesData.matches.length} risultati ordinati per{' '}
                    {filters.sortBy === 'relevance'
                      ? 'rilevanza'
                      : filters.sortBy === 'date'
                      ? 'data'
                      : filters.sortBy === 'distance'
                      ? 'distanza'
                      : 'prezzo'}
                  </span>
                )}
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[1, 2, 3, 4, 5, 6].map((idx) => (
                    <div
                      key={idx}
                      className="bg-card border border-border-subtle rounded-2xl overflow-hidden p-4 space-y-3 animate-pulse"
                    >
                      <div className="aspect-[16/9] bg-card-subtle rounded-xl" />
                      <div className="h-4 bg-card-subtle rounded w-3/4" />
                      <div className="h-3 bg-card-subtle rounded w-1/2" />
                      <div className="h-8 bg-card-subtle rounded-full mt-2" />
                    </div>
                  ))}
                </div>
              ) : matchesData && matchesData.matches.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {matchesData.matches.map((item) => (
                    <EventCard
                      key={item.event.id}
                      match={item}
                      isFavorite={isFavorite(item.event.id)}
                      onToggleFavorite={() => toggleFavorite(item.event)}
                      onSelectEvent={() => setSelectedEvent(item)}
                    />
                  ))}
                </div>
              ) : !error ? (
                <div className="bg-card border border-border-subtle rounded-2xl p-8 sm:p-12 text-center space-y-3 max-w-lg mx-auto">
                  <Music className="w-8 h-8 text-text-muted mx-auto" />
                  <h4 className="text-base font-bold text-white">Nessun concerto trovato</h4>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Prova ad aumentare il raggio di ricerca o a rimuovere il limite massimo di prezzo.
                  </p>
                  <button
                    onClick={() =>
                      handleFilterChange(
                        { radiusKm: 150, maxPrice: undefined, includeUnpriced: true },
                        true
                      )
                    }
                    className="px-5 py-2 rounded-full bg-accent-lime hover:bg-accent-lime-hover text-on-lime font-bold text-xs transition-colors"
                  >
                    Estendi raggio a 150 km
                  </button>
                </div>
              ) : null}
            </section>
          </>
        )}

        {activeTab === 'map' && (
          <EventHeatmapView
            matches={matchesData?.matches || []}
            filters={filters}
            loading={loading}
            isFavorite={isFavorite}
            onToggleFavorite={(m) => toggleFavorite(m.event)}
            onSelectEvent={(m) => setSelectedEvent(m)}
            onChangeLocation={(lat, lon) => handleFilterChange({ lat, lon }, true)}
          />
        )}

        {activeTab === 'favorites' && (
          <FavoritesView
            favorites={favorites}
            onRemoveFavorite={removeFavorite}
            onExploreMatches={() => setActiveTab('matches')}
          />
        )}

        {activeTab === 'account' && (
          <AccountView
            session={session}
            matchesData={matchesData}
            filters={filters}
            loading={loading}
            onSpotifyLogin={handleSpotifyLogin}
            onMockLogin={handleMockLogin}
            onLogout={handleLogout}
            onDeleteAccount={handleDeleteAccount}
            onOpenPrivacyTab={() => handleOpenLegal('architecture')}
          />
        )}
      </main>

      {/* Bottom Legal, Privacy & Cookie Footer (like reference screenshot) */}
      <Footer onOpenLegal={handleOpenLegal} />

      {/* iPhone-Style Floating Bottom Tab Bar Menu */}
      <IPhoneTabBar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        favoritesCount={totalFavorites}
        isAuthenticated={session.authenticated}
      />

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          match={selectedEvent}
          isOpen={Boolean(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
          isFavorite={isFavorite(selectedEvent.event.id)}
          onToggleFavorite={() => toggleFavorite(selectedEvent.event)}
        />
      )}

      {/* Privacy, Cookie, Terms & Architecture Modal */}
      <LegalModal
        isOpen={legalModalOpen}
        activeTab={legalTab}
        onTabChange={setLegalTab}
        onClose={() => setLegalModalOpen(false)}
        isAuthenticated={session.authenticated}
        onDeleteAccount={handleDeleteAccount}
      />
    </div>
  );
}

export default App;
