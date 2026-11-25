import React, { useEffect } from 'react';
import { X, ShieldCheck, Cookie, FileText, Radio, Database, Lock, Trash2 } from 'lucide-react';

export type LegalTab = 'privacy' | 'cookie' | 'terms' | 'architecture';

interface LegalModalProps {
  isOpen: boolean;
  activeTab: LegalTab;
  onTabChange: (tab: LegalTab) => void;
  onClose: () => void;
  isAuthenticated?: boolean;
  onDeleteAccount?: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  activeTab,
  onTabChange,
  onClose,
  isAuthenticated,
  onDeleteAccount,
}) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKey);
    }
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tabs: Array<{ id: LegalTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'privacy', label: 'Privacy', icon: Lock },
    { id: 'cookie', label: 'Cookie', icon: Cookie },
    { id: 'terms', label: 'Termini', icon: FileText },
    { id: 'architecture', label: 'Privacy-by-Design', icon: ShieldCheck },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-card border border-border-active rounded-3xl shadow-popover overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border-subtle bg-surface flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Trasparenza, Privacy e Cookie</h3>
            <p className="text-xs text-text-muted">Progetto sperimentale EventSpot — Politecnico di Bari</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-text-muted hover:text-white hover:bg-card-subtle transition-colors"
            aria-label="Chiudi informativa"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="px-5 pt-3 border-b border-border-subtle flex flex-wrap gap-1.5 bg-surface/60 pb-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-accent-lime text-on-lime font-bold'
                    : 'bg-card-subtle text-text-secondary hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-text-secondary leading-relaxed">
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <h4 className="text-base font-bold text-white">Informativa Privacy e Diritto all'Oblio</h4>
              <p>
                EventSpot adotta un approccio <strong>zero-history</strong> conforme ai principi di minimizzazione GDPR:
                nessun brano riprodotto su Spotify, nessuna cronologia musicale e nessuna lista di concerti preferiti vengono mai salvati in modo permanente sui nostri server.
              </p>
              <ul className="space-y-2 list-disc list-inside text-xs sm:text-sm">
                <li>
                  <strong className="text-white">Dati di sessione effimeri:</strong> i token OAuth 2.0 PKCE sono cifrati a riposo con AES-256-GCM e cancellati automaticamente da MongoDB dopo 24 ore (indici TTL nativi).
                </li>
                <li>
                  <strong className="text-white">Pseudonimizzazione:</strong> l'identificativo utente è trasformato tramite HMAC-SHA256 irreversibile.
                </li>
                <li>
                  <strong className="text-white">Cancellazione immediata:</strong> puoi revocare la tua sessione e distruggere qualsiasi chiave crittografica in qualsiasi momento tramite <code className="font-mono text-accent-lime">DELETE /v1/auth/me</code>.
                </li>
              </ul>

              {isAuthenticated && onDeleteAccount && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      onDeleteAccount();
                      onClose();
                    }}
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-accent-rose/15 hover:bg-accent-rose text-accent-rose hover:text-white border border-accent-rose/30 text-xs font-bold transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Esegui ora cancellazione immediata GDPR</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'cookie' && (
            <div className="space-y-4">
              <h4 className="text-base font-bold text-white">Cookie Policy (Solo Cookie Tecnici)</h4>
              <p>
                EventSpot <strong>non utilizza alcun cookie di profilazione, marketing o tracciamento analitico di terze parti</strong>.
              </p>
              <div className="bg-card-subtle border border-border-subtle rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between font-bold text-white">
                  <span>eventspot_session</span>
                  <span className="text-accent-lime">Cookie Tecnico Strettamente Necessario</span>
                </div>
                <p className="text-text-secondary">
                  Attributi: <code className="font-mono text-white">HttpOnly; SameSite=Lax; Path=/</code> (durata max 24h). Indispensabile per associare in sicurezza la sessione autenticata senza esporre token OAuth al codice JavaScript del browser.
                </p>
              </div>
              <div className="bg-card-subtle border border-border-subtle rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between font-bold text-white">
                  <span>eventspot_favorites_v1</span>
                  <span className="text-accent-sky">Browser localStorage (Locale)</span>
                </div>
                <p className="text-text-secondary">
                  Spazio di archiviazione locale utilizzato unicamente sul tuo dispositivo per conservare i concerti salvati tra i preferiti senza trasmissione verso il server.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-4">
              <h4 className="text-base font-bold text-white">Termini di Utilizzo & Note Legali</h4>
              <p>
                EventSpot è un prototipo sperimentale realizzato nell'ambito di una tesi di laurea triennale in Ingegneria Informatica presso il Politecnico di Bari.
              </p>
              <ul className="space-y-2 list-disc list-inside text-xs sm:text-sm">
                <li>EventSpot non effettua vendita diretta di biglietti né gestisce transazioni di pagamento: i link di acquisto reindirizzano verso le piattaforme ufficiali (Ticketmaster e biglietterie collegate).</li>
                <li>I dati musicali di sessione appartengono a Spotify Web API e non vengono impiegati per l'addestramento di modelli di Machine Learning.</li>
                <li>I dati cartografici della mappa termica utilizzano OpenStreetMap & CARTO DarkMatter.</li>
                <li>I dati meteorologici in tempo reale sono forniti da Open-Meteo API.</li>
              </ul>
            </div>
          )}

          {activeTab === 'architecture' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Radio className="w-4 h-4 text-accent-lime" />
                  <span>Dal Context-Aware al Context-Driven (Pagano et al., 2016)</span>
                </h4>
                <p>
                  Il target della raccomandazione non è uno User ID storico profilato nel tempo, ma lo Stato Contestuale immediato:
                </p>
                <div className="bg-card-subtle p-3 rounded-xl font-mono text-xs text-accent-lime border border-border-subtle">
                  C = ⟨ T_session, slot_now, loc_user, W_now, B_max ⟩
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-card-subtle border border-border-subtle p-3.5 rounded-2xl space-y-1">
                  <div className="flex items-center space-x-2 text-white font-semibold">
                    <Database className="w-4 h-4 text-accent-lime" />
                    <span>Zero Persistenza Storica</span>
                  </div>
                  <p className="text-text-muted">
                    Nessun brano ascoltato viene archiviato. Decadimento esponenziale sui generi recenti e scadenza TTL su tutte le cache.
                  </p>
                </div>

                <div className="bg-card-subtle border border-border-subtle p-3.5 rounded-2xl space-y-1">
                  <div className="flex items-center space-x-2 text-white font-semibold">
                    <ShieldCheck className="w-4 h-4 text-accent-lime" />
                    <span>Scoring White-Box & Heatmap</span>
                  </div>
                  <p className="text-text-muted">
                    Combinazione deterministica TF-IDF Cosine, congruenza weekday-hour, decadimento Haversine, meteo e rappresentazione su mappa termica.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-subtle bg-surface flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-full bg-accent-lime hover:bg-accent-lime-hover text-on-lime font-bold text-xs transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
