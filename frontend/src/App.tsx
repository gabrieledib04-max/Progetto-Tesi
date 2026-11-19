import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.js';
import { ContextRibbon } from './components/ContextRibbon.js';
import { FilterControls } from './components/FilterControls.js';
import { EventCard } from './components/EventCard.js';
import { FavoritesView } from './components/FavoritesView.js';
import { EventDetailModal } from './components/EventDetailModal.js';
import { PrivacyInfoModal } from './components/PrivacyInfoModal.js';
import { apiClient, SearchFilters, SessionInfo } from './api/client.js';
import { useFavorites } from './hooks/useFavorites.js';
import { MatchesResponse, ScoredEvent } from '@eventspot/shared';
import { AlertCircle, Music, BookOpen, Github } from 'lucide-react';

export function App() {
  const [session, setSession] = useState<SessionInfo>({ authenticated: false });
  const [activeTab, setActiveTab] = useState<'matches' | 'favorites'>('matches');
  const [matchesData, setMatchesData] = useState<MatchesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedEvent, setSelectedEvent] = useState<ScoredEvent | null>(null);
  const [privacyModalOpen, setPrivacyModalOpen] = useState<boolean>(false);

  // Default coordinates: Milan (45.4642, 9.1900)
  const [filters, setFilters] = useState<SearchFilters>({
    lat: 45.4642,
    lon: 9.1900,
    radiusKm: 50,
    sortBy: 'relevance',
    includeUnpriced: true,
  });

  const { favorites, isFavorite, toggleFavorite, removeFavorite, totalFavorites } = useFavorites();

  // Load session on startup
  const checkSession = useCallback(async () => {
    try {
      const sess = await apiClient.getSession();
      setSession(sess);
    } catch {
      setSession({ authenticated: false });
    }
  }, []);

  // Fetch recommendations
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
    // Check URL parameters for OAuth feedback
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

  // Auth actions
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
      'Vuoi cancellare immediatamente e in modo irreversibile tutti i dati effimeri della tua sessione (GDPR Diritto all\'Oblio)?'
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

  const handleFilterChange = (updated: Partial<SearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...updated }));
  };

  const handleFilterSubmit = () => {
    loadMatches(filters);
  };

  return (
    <div className="min-h-screen bg-canvas text-text-primary flex flex-col justify-between selection:bg-accent-amber/30 selection:text-white">
      {/* Header */}
      <Header
        session={session}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        favoritesCount={totalFavorites}
        onSpotifyLogin={handleSpotifyLogin}
        onMockLogin={handleMockLogin}
        onLogout={handleLogout}
        onDeleteAccount={handleDeleteAccount}
        onOpenPrivacyModal={() => setPrivacyModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {activeTab === 'matches' ? (
          <>
            {/* Real-time Context Ribbon */}
            <ContextRibbon data={matchesData} loading={loading} />

            {/* Filter Controls */}
            <FilterControls
              filters={filters}
              onChange={handleFilterChange}
              onSubmit={handleFilterSubmit}
              loading={loading}
            />

            {/* Error Message */}
            {error && (
              <div className="bg-accent-rose/10 border border-accent-rose/30 text-accent-rose rounded-2xl p-4 flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  onClick={() => loadMatches(filters)}
                  className="px-3 py-1 bg-accent-rose/20 hover:bg-accent-rose/30 rounded-lg font-semibold transition-colors"
                >
                  Riprova
                </button>
              </div>
            )}

            {/* Recommendations Grid */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
                  <Music className="w-4 h-4 text-accent-amber" />
                  <span>Concerti ed Eventi Selezionati</span>
                </h3>
                {matchesData && !loading && (
                  <span className="text-xs text-text-muted">
                    {matchesData.matches.length} consigli ordinati per{' '}
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
                // Skeletons
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[1, 2, 3, 4, 5, 6].map((idx) => (
                    <div
                      key={idx}
                      className="bg-card border border-border-subtle rounded-2xl overflow-hidden p-4 space-y-3 animate-pulse"
                    >
                      <div className="aspect-[16/9] bg-card-subtle rounded-xl" />
                      <div className="h-4 bg-card-subtle rounded w-3/4" />
                      <div className="h-3 bg-card-subtle rounded w-1/2" />
                      <div className="h-8 bg-card-subtle rounded mt-2" />
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
                  <h4 className="text-base font-semibold text-white">Nessun concerto trovato</h4>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Prova ad aumentare il raggio di ricerca (ad es. a 100 km) o a deselezionare il vincolo di prezzo massimo.
                  </p>
                  <button
                    onClick={() => {
                      handleFilterChange({ radiusKm: 100, maxPrice: undefined, includeUnpriced: true });
                      loadMatches({ ...filters, radiusKm: 100, maxPrice: undefined, includeUnpriced: true });
                    }}
                    className="px-4 py-2 rounded-xl bg-card-subtle hover:bg-card border border-border-subtle text-xs text-white transition-colors"
                  >
                    Estendi raggio a 100 km
                  </button>
                </div>
              ) : null}
            </section>
          </>
        ) : (
          /* Favorites Tab */
          <FavoritesView
            favorites={favorites}
            onRemoveFavorite={removeFavorite}
            onExploreMatches={() => setActiveTab('matches')}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border-subtle bg-surface/50 mt-12 py-6 text-xs text-text-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2 text-center sm:text-left">
            <span>EventSpot · Tesi Triennale in Ingegneria Informatica</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline text-text-secondary">Architettura Context-Driven a 3 Microservizi</span>
          </div>

          <div className="flex items-center space-x-4">
            <a
              href="/v1/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white flex items-center space-x-1 transition-colors"
              title="OpenAPI 3.1 Swagger UI"
            >
              <BookOpen className="w-3.5 h-3.5 text-accent-amber" />
              <span>OpenAPI 3.1 Docs</span>
            </a>
            <a
              href="https://github.com/gabrieledib04-max/Progetto-Tesi"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white flex items-center space-x-1 transition-colors"
              title="Repository GitHub"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </footer>

      {/* Event Details Dialog Modal */}
      {selectedEvent && (
        <EventDetailModal
          match={selectedEvent}
          isOpen={Boolean(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
          isFavorite={isFavorite(selectedEvent.event.id)}
          onToggleFavorite={() => toggleFavorite(selectedEvent.event)}
        />
      )}

      {/* Privacy Architecture Info Modal */}
      <PrivacyInfoModal
        isOpen={privacyModalOpen}
        onClose={() => setPrivacyModalOpen(false)}
      />
    </div>
  );
}

export default App;
