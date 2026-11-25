import React from 'react';
import { MapPin, Sparkles, UserCheck } from 'lucide-react';
import { SessionInfo } from '../api/client.js';

interface HeaderProps {
  session: SessionInfo;
  onGoToAccount: () => void;
  onGoHome: () => void;
}

export const Header: React.FC<HeaderProps> = ({ session, onGoToAccount, onGoHome }) => {
  return (
    <header className="sticky top-0 z-30 bg-canvas/85 backdrop-blur-xl border-b border-border-subtle/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Stylized Acid Lime Pin + Wordmark (matching reference style) */}
        <button
          onClick={onGoHome}
          className="flex items-center space-x-2.5 text-left group focus-visible:rounded-xl"
          aria-label="EventSpot Home"
        >
          <div className="w-8 h-8 rounded-xl bg-accent-lime flex items-center justify-center text-on-lime shadow-lime group-hover:scale-105 transition-transform">
            <MapPin className="w-4 h-4 stroke-[2.75]" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-white">eventspot</span>
        </button>

        {/* Right: Single crisp action / status pill (navigation lives in the iOS bottom tab bar) */}
        <button
          onClick={onGoToAccount}
          className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-card hover:bg-card-subtle border border-border-subtle hover:border-border-active text-xs font-semibold text-white transition-colors"
        >
          {session.authenticated ? (
            <>
              <span className="w-2 h-2 rounded-full bg-accent-lime" />
              <UserCheck className="w-3.5 h-3.5 text-accent-lime" />
              <span className="font-mono text-text-secondary max-w-[96px] truncate">
                {session.userHash?.slice(0, 8)}
              </span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-accent-lime" />
              <span>Accedi</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
