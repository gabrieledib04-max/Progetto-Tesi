import React from 'react';
import { LegalTab } from './LegalModal.js';

interface FooterProps {
  onOpenLegal: (tab: LegalTab) => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenLegal }) => {
  return (
    <footer className="mt-16 pt-8 pb-28 sm:pb-32 border-t border-border-subtle/80 text-center">
      <div className="max-w-3xl mx-auto px-4 space-y-4">
        <p className="text-xs font-semibold text-white">
          EventSpot — Tesi in Ingegneria Informatica
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-text-muted">
          <button
            type="button"
            onClick={() => onOpenLegal('privacy')}
            className="hover:text-white transition-colors"
          >
            Privacy
          </button>
          <button
            type="button"
            onClick={() => onOpenLegal('cookie')}
            className="hover:text-white transition-colors"
          >
            Cookie
          </button>
          <button
            type="button"
            onClick={() => onOpenLegal('terms')}
            className="hover:text-white transition-colors"
          >
            Termini
          </button>
          <button
            type="button"
            onClick={() => onOpenLegal('architecture')}
            className="hover:text-white transition-colors"
          >
            Privacy-by-Design
          </button>
          <a
            href="/v1/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent-lime transition-colors"
          >
            OpenAPI Docs
          </a>
          <a
            href="https://github.com/gabrieledib04-max/Progetto-Tesi"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
};
