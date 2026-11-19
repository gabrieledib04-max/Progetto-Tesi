import React from 'react';
import { X, ShieldCheck, Database, Lock, Eye, Radio } from 'lucide-react';

interface PrivacyInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyInfoModal: React.FC<PrivacyInfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl bg-card border border-border-subtle rounded-3xl shadow-popover overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border-subtle bg-surface flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-emerald/15 text-accent-emerald flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Architettura & Privacy-by-Design</h3>
              <p className="text-xs text-text-muted">Progetto di Tesi in Ingegneria Informatica</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-card-subtle transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm text-text-secondary leading-relaxed">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-white flex items-center space-x-2">
              <Radio className="w-4 h-4 text-accent-amber" />
              <span>Dal Context-Aware al Context-Driven (Pagano et al., 2016)</span>
            </h4>
            <p>
              A differenza dei tradizionali sistemi di raccomandazione collaborativi che profilano e tracciano l'utente nel tempo,
              <strong> EventSpot non persiste lo storico d'ascolto né costruisce profili a lungo termine</strong>. Il target della raccomandazione è lo stato contestuale corrente:
            </p>
            <div className="bg-card-subtle p-3 rounded-xl font-mono text-xs text-accent-amber border border-border-subtle">
              C = ⟨ T_session, slot_now, loc_user, W_now, B_max ⟩
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            <div className="bg-card-subtle/50 border border-border-subtle p-3.5 rounded-2xl space-y-1.5">
              <div className="flex items-center space-x-2 text-white font-medium text-xs">
                <Database className="w-4 h-4 text-accent-sky" />
                <span>Zero Persistenza Storica</span>
              </div>
              <p className="text-xs text-text-muted">
                Nessun brano o artista ascoltato viene archiviato in database. I dati estratti da Spotify decadono esponenzialmente e svaniscono al termine della sessione.
              </p>
            </div>

            <div className="bg-card-subtle/50 border border-border-subtle p-3.5 rounded-2xl space-y-1.5">
              <div className="flex items-center space-x-2 text-white font-medium text-xs">
                <Lock className="w-4 h-4 text-accent-emerald" />
                <span>Sessioni TTL & AES-256-GCM</span>
              </div>
              <p className="text-xs text-text-muted">
                I token OAuth sono cifrati a riposo con chiave a 256 bit e distrutti automaticamente da MongoDB dopo 24 ore tramite indici TTL nativi.
              </p>
            </div>

            <div className="bg-card-subtle/50 border border-border-subtle p-3.5 rounded-2xl space-y-1.5">
              <div className="flex items-center space-x-2 text-white font-medium text-xs">
                <ShieldCheck className="w-4 h-4 text-accent-rose" />
                <span>Preferiti Local-First</span>
              </div>
              <p className="text-xs text-text-muted">
                I tuoi concerti preferiti rimangono confinati nel <code className="font-mono text-accent-rose">localStorage</code> del tuo browser e non transitano mai verso i server.
              </p>
            </div>

            <div className="bg-card-subtle/50 border border-border-subtle p-3.5 rounded-2xl space-y-1.5">
              <div className="flex items-center space-x-2 text-white font-medium text-xs">
                <Eye className="w-4 h-4 text-accent-amber" />
                <span>Explainability Trasparente</span>
              </div>
              <p className="text-xs text-text-muted">
                Nessuna black-box. Ogni suggerimento espone in chiaro i fattori deterministici che hanno composto il punteggio finale.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-subtle bg-surface flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-accent-amber hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors"
          >
            Ho capito
          </button>
        </div>
      </div>
    </div>
  );
};
