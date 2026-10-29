import React from 'react';
import type { Language } from '../types';
import { UI_TRANSLATIONS } from '../utils/translations';
import {
  UtensilsCrossed,
  Globe,
  Wifi,
  WifiOff,
  RefreshCw,
  LayoutGrid,
  Sliders,
  Columns,
  AlertTriangle,
  BookOpen,
  Compass,
} from 'lucide-react';

export type ViewMode = 'client' | 'sandbox' | 'split';

interface NavbarProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  tableNumber: string;
  setTableNumber: (table: string) => void;
  isOffline: boolean;
  unsyncedCount: number;
  onSyncOffline: () => void;
  isSyncing: boolean;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  hasActiveChaos: boolean;
  onOpenGuide: () => void;
  onStartTour?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  language,
  setLanguage,
  tableNumber,
  setTableNumber,
  isOffline,
  unsyncedCount,
  onSyncOffline,
  isSyncing,
  viewMode,
  setViewMode,
  hasActiveChaos,
  onOpenGuide,
  onStartTour,
}) => {
  const t = UI_TRANSLATIONS[language];

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-orange-100/80 sticky top-0 z-50 px-4 py-2.5 transition-colors shadow-sm shadow-orange-950/5">
      <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center shadow-md shadow-orange-500/25 ring-2 ring-orange-200/50">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-stone-900 flex items-center gap-1">
                Resto<span className="text-orange-500">Pulse</span>
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                POS & KDS
              </span>
            </div>
            <p className="text-xs text-stone-500 hidden sm:block">
              {t.app_tagline}
            </p>
          </div>
        </div>

        {/* View Switcher: 2 Main Views (Client vs Sandbox) + Optional Split + Guide + Tour */}
        <div className="flex items-center gap-2">
          <div data-tour="navbar-views" className="flex items-center bg-stone-100/80 p-1 rounded-2xl border border-stone-200/80 shadow-inner">
            <button
              onClick={() => setViewMode('client')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'client'
                  ? 'bg-white text-orange-600 shadow-sm shadow-orange-950/10'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-orange-500" />
              <span>{t.view_mode_client}</span>
            </button>

            <button
              onClick={() => setViewMode('sandbox')}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'sandbox'
                  ? 'bg-white text-orange-600 shadow-sm shadow-orange-950/10'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-orange-500" />
              <span>{t.view_mode_sandbox}</span>
              {hasActiveChaos && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute top-1 right-1"></span>
              )}
            </button>

            <button
              onClick={() => setViewMode('split')}
              title={t.view_mode_split}
              className={`hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                viewMode === 'split'
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="text-[11px]">{t.view_mode_split}</span>
            </button>
          </div>

          {/* Guide & Context Onboarding Button */}
          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold text-orange-800 bg-orange-100/70 hover:bg-orange-200/70 border border-orange-300/80 transition-all shadow-xs active:scale-95"
            title={t.nav_guide}
          >
            <BookOpen className="w-3.5 h-3.5 text-orange-600" />
            <span className="hidden sm:inline">{t.nav_guide}</span>
          </button>

          {/* Interactive Spotlight Tour Button */}
          {onStartTour && (
            <button
              onClick={onStartTour}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200/80 border border-amber-300 transition-all shadow-xs active:scale-95"
              title="Mulai Interactive Guided Tour"
            >
              <Compass className="w-3.5 h-3.5 text-amber-600 animate-spin-slow" />
              <span className="hidden sm:inline">Tour</span>
            </button>
          )}
        </div>

        {/* Right Controls: Table Selector, Status Badges, Language */}
        <div data-tour="navbar-table-lang" className="flex items-center flex-wrap gap-2.5">
          {/* Active Chaos Warning Pill in Client View */}
          {hasActiveChaos && viewMode === 'client' && (
            <button
              onClick={() => setViewMode('sandbox')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100 transition-colors shadow-xs animate-pulse"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span>{t.active_chaos_alert}</span>
            </button>
          )}

          {/* Table Selector */}
          <div className="flex items-center gap-1.5 bg-orange-50/70 px-2.5 py-1.5 rounded-xl border border-orange-200/80 text-xs text-stone-700">
            <span className="text-stone-500 font-medium">{t.table_label}:</span>
            <select
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="bg-white text-orange-700 font-bold rounded-lg px-2 py-0.5 border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-xs shadow-2xs"
            >
              <option value="T-01">Meja T-01</option>
              <option value="T-02">Meja T-02</option>
              <option value="T-03">Meja T-03</option>
              <option value="T-04">Meja T-04</option>
              <option value="T-05">Meja T-05</option>
              <option value="T-06">Meja T-06</option>
              <option value="VIP-01">VIP 01 (Private Room)</option>
              <option value="TA-01">Takeaway #01</option>
            </select>
          </div>

          {/* Offline / Online Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-2xs ${
              isOffline
                ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            {isOffline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-500" />
                <span>{t.offline_badge}</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                <span>Online</span>
              </>
            )}
          </div>

          {/* Unsynced Offline Queue Indicator */}
          {unsyncedCount > 0 && (
            <button
              onClick={onSyncOffline}
              disabled={isSyncing || isOffline}
              title={isOffline ? 'WiFi Offline: Hubungkan koneksi untuk sync' : 'Klik untuk sinkronisasi batch'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-sm ${
                isOffline
                  ? 'bg-amber-100 text-amber-800 border-amber-300 opacity-90 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-orange-500 cursor-pointer shadow-orange-500/20 active:scale-95'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                {unsyncedCount} {t.unsynced_badge}
              </span>
              {!isOffline && (
                <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded font-bold ml-0.5">
                  {t.sync_now}
                </span>
              )}
            </button>
          )}

          {/* Language Switcher */}
          <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200">
            <Globe className="w-3.5 h-3.5 text-stone-500 mx-1" />
            <button
              onClick={() => setLanguage('id')}
              className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                language === 'id'
                  ? 'bg-white text-orange-600 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              ID
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                language === 'en'
                  ? 'bg-white text-orange-600 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('zh')}
              className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                language === 'zh'
                  ? 'bg-white text-orange-600 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              中文
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
