import React from 'react';
import { Sparkles, Flame, Heart, User } from 'lucide-react';

export type AppTab = 'matches' | 'map' | 'favorites' | 'account';

interface IPhoneTabBarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  favoritesCount: number;
  isAuthenticated: boolean;
}

export const IPhoneTabBar: React.FC<IPhoneTabBarProps> = ({
  activeTab,
  onTabChange,
  favoritesCount,
  isAuthenticated,
}) => {
  const tabs: Array<{
    id: AppTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    dot?: boolean;
  }> = [
    { id: 'matches', label: 'Per te', icon: Sparkles },
    { id: 'map', label: 'Mappa', icon: Flame },
    {
      id: 'favorites',
      label: 'Preferiti',
      icon: Heart,
      badge: favoritesCount > 0 ? favoritesCount : undefined,
    },
    {
      id: 'account',
      label: 'Account',
      icon: User,
      dot: isAuthenticated,
    },
  ];

  return (
    <div
      className="fixed bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-[440px]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <nav
        role="tablist"
        aria-label="Menu principale stile iOS"
        className="grid grid-cols-4 gap-1 p-1.5 rounded-[30px] bg-[#121316]/88 backdrop-blur-2xl border border-white/10 shadow-[0_16px_42px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.08)]"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-[24px] active:scale-95 transition-transform transition-colors ${
                isActive
                  ? 'bg-white/[0.09] text-accent-primary'
                  : 'text-[#8c919b] hover:text-white'
              }`}
            >
              <div className="relative flex items-center justify-center mb-0.5">
                <Icon
                  className={`w-5 h-5 ${
                    isActive ? 'stroke-[2.3]' : 'stroke-[1.9]'
                  }`}
                />

                {/* Numeric iOS badge for Favorites */}
                {tab.badge !== undefined && (
                  <span
                    className={`absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center leading-none ${
                      isActive
                        ? 'bg-accent-primary text-on-accent'
                        : 'bg-accent-rose text-white'
                    }`}
                  >
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}

                {/* Live status dot for Account */}
                {tab.dot && (
                  <span
                    className={`absolute -top-0.5 -right-1.5 w-2 h-2 rounded-full ring-2 ring-[#121316] ${
                      isActive ? 'bg-accent-primary' : 'bg-accent-emerald'
                    }`}
                  />
                )}
              </div>

              <span
                className={`text-[11px] leading-tight tracking-tight ${
                  isActive ? 'font-semibold text-accent-primary' : 'font-medium'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
