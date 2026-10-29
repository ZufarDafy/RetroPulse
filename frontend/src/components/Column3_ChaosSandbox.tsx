import React, { useState } from 'react';
import type { ChaosConfig, DiagnosticLog, Language, LogCategory } from '../types';
import { UI_TRANSLATIONS } from '../utils/translations';
import { playTapSound } from '../utils/sound';
import {
  Activity,
  WifiOff,
  Clock,
  Printer,
  Database,
  RotateCcw,
  Download,
  Trash2,
  Search,
  HelpCircle,
  Sliders,
} from 'lucide-react';

interface Column3ChaosSandboxProps {
  language: Language;
  chaosConfig: ChaosConfig;
  onUpdateChaos: (updated: Partial<ChaosConfig>) => void;
  logs: DiagnosticLog[];
  onClearLogs: () => void;
  blockedTapsCount: number;
  unsyncedCount: number;
  totalOrdersCount: number;
}

export const Column3_ChaosSandbox: React.FC<Column3ChaosSandboxProps> = ({
  language,
  chaosConfig,
  onUpdateChaos,
  logs,
  onClearLogs,
  blockedTapsCount,
  unsyncedCount,
  totalOrdersCount,
}) => {
  const t = UI_TRANSLATIONS[language];
  const [selectedCategory, setSelectedCategory] = useState<LogCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Chaos toggles
  const handleToggleWifi = () => {
    playTapSound();
    onUpdateChaos({ wifi_offline: !chaosConfig.wifi_offline });
  };

  const handleToggleLatency = () => {
    playTapSound();
    onUpdateChaos({
      bad_network_latency_ms: chaosConfig.bad_network_latency_ms > 0 ? 0 : 2500,
    });
  };

  const handleTogglePrinter = () => {
    playTapSound();
    onUpdateChaos({
      printer_status: chaosConfig.printer_status === 'CONNECTED' ? 'DISCONNECTED' : 'CONNECTED',
    });
  };

  const handleToggleDBLock = () => {
    playTapSound();
    onUpdateChaos({ db_lock_simulated: !chaosConfig.db_lock_simulated });
  };

  const handleResetAll = () => {
    playTapSound();
    onUpdateChaos({
      wifi_offline: false,
      bad_network_latency_ms: 0,
      printer_status: 'CONNECTED',
      db_lock_simulated: false,
    });
  };

  // Export logs to JSON
  const handleExportJSON = () => {
    playTapSound();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `restopulse-diagnostic-logs-${new Date().toISOString()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesCat = selectedCategory === 'ALL' || log.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.root_cause.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Automated Root-Cause Helper
  const getRootCauseExplanation = (log: DiagnosticLog) => {
    switch (log.root_cause) {
      case 'RAPID_DOUBLE_TAP_PREVENTED':
        return 'Analisis: Staf kasir panik menekan checkout berulang kali saat latensi tinggi. Mesin idempotensi lokal memblokir eksekusi ganda.';
      case 'IDEMPOTENCY_DUPLICATE_ABSORBED':
        return 'Analisis: Request dengan Idempotency Key yang sama tiba di backend. Pesanan eksisting dikembalikan tanpa membuat tiket kembar.';
      case 'PRINTER_UNREACHABLE_QUEUED_REPRINT':
        return 'Analisis: Printer thermal Bluetooth terputus/habis kertas. Pesanan tetap sukses di DB & dapur, struk dialihkan ke antrian cetak ulang.';
      case 'SIMULATED_DB_LOCK':
        return 'Analisis: Deadlock database / SQLite contention diinjeksikan. Klien menerima pesan error manusiawi dan keranjang tetap aman.';
      case 'BATCH_SYNC_RESOLVED':
        return 'Analisis: Koneksi internet pulih. Seluruh pesanan yang tertampung di LocalStorage berhasil direkonsiliasi ke server.';
      case 'CHAOS_WIFI_OFFLINE':
        return 'Analisis: WiFi restoran drop disimulasikan. Mode penyimpanan luring (Offline Queue) diaktifkan otomatis.';
      default:
        return null;
    }
  };

  return (
    <div data-tour="chaos-sandbox-container" className="flex flex-col h-full min-h-0 bg-white rounded-3xl border border-orange-100 shadow-md shadow-orange-950/5 overflow-hidden transition-all">
      {/* Column Header */}
      <div className="flex-shrink-0 p-4 border-b border-orange-100 bg-gradient-to-r from-orange-50/80 to-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-1.5">
              <span>{t.col3_title}</span>
            </h2>
            <p className="text-xs text-stone-500">{t.col3_subtitle}</p>
          </div>
        </div>

        {/* Reset All Button */}
        <button
          onClick={handleResetAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-orange-50 text-stone-700 hover:text-orange-600 border border-stone-200 text-xs font-bold transition-all shadow-2xs active:scale-95"
        >
          <RotateCcw className="w-3.5 h-3.5 text-orange-500" />
          <span>{t.btn_reset_chaos}</span>
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="flex-shrink-0 p-4 border-b border-stone-100 bg-[#fffdfa] grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
        <div className="p-2.5 rounded-2xl bg-white border border-stone-200/80 shadow-2xs">
          <span className="block text-[10px] text-stone-400 uppercase font-bold">{t.stat_orders}</span>
          <span className="font-mono text-lg font-extrabold text-stone-900">{totalOrdersCount}</span>
        </div>
        <div className="p-2.5 rounded-2xl bg-white border border-amber-200 shadow-2xs">
          <span className="block text-[10px] text-amber-600 uppercase font-bold">{t.stat_blocked_taps}</span>
          <span className="font-mono text-lg font-extrabold text-amber-600">{blockedTapsCount}</span>
        </div>
        <div className="p-2.5 rounded-2xl bg-white border border-rose-200 shadow-2xs">
          <span className="block text-[10px] text-rose-600 uppercase font-bold">{t.stat_queued_offline}</span>
          <span className="font-mono text-lg font-extrabold text-rose-600">{unsyncedCount}</span>
        </div>
        <div className="p-2.5 rounded-2xl bg-white border border-blue-200 shadow-2xs">
          <span className="block text-[10px] text-blue-600 uppercase font-bold">{t.stat_latency}</span>
          <span className="font-mono text-lg font-extrabold text-blue-600">
            {chaosConfig.bad_network_latency_ms}ms
          </span>
        </div>
      </div>

      {/* 4 Chaos Toggles Section */}
      <div className="flex-shrink-0 p-4 border-b border-orange-100 bg-white space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-orange-500" />
            <span>{t.chaos_title}</span>
          </h3>
          <span className="text-[11px] text-stone-400 font-medium">Klik untuk simulasi gangguan</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          {/* Toggle 1: WiFi Drop (Offline Mode) */}
          <div
            onClick={handleToggleWifi}
            className={`cursor-pointer select-none p-3 rounded-2xl border transition-all flex items-center justify-between ${
              chaosConfig.wifi_offline
                ? 'bg-rose-50 border-rose-300 text-rose-900 ring-2 ring-rose-200/60 shadow-sm'
                : 'bg-stone-50 hover:bg-stone-100/70 border-stone-200 text-stone-700'
            }`}
          >
            <div className="flex items-center gap-2.5 pr-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${chaosConfig.wifi_offline ? 'bg-rose-500 text-white' : 'bg-stone-200 text-stone-500'}`}>
                <WifiOff className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold block leading-tight">1. WiFi Drop (Offline)</span>
                <span className="text-[10px] text-stone-500">Putus koneksi kasir</span>
              </div>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${chaosConfig.wifi_offline ? 'bg-rose-500' : 'bg-stone-300'}`}>
              <div className={`w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${chaosConfig.wifi_offline ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </div>

          {/* Toggle 2: Bad Network Latency (2500ms) */}
          <div
            onClick={handleToggleLatency}
            className={`cursor-pointer select-none p-3 rounded-2xl border transition-all flex items-center justify-between ${
              chaosConfig.bad_network_latency_ms > 0
                ? 'bg-amber-50 border-amber-300 text-amber-900 ring-2 ring-amber-200/60 shadow-sm'
                : 'bg-stone-50 hover:bg-stone-100/70 border-stone-200 text-stone-700'
            }`}
          >
            <div className="flex items-center gap-2.5 pr-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${chaosConfig.bad_network_latency_ms > 0 ? 'bg-amber-500 text-white' : 'bg-stone-200 text-stone-500'}`}>
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold block leading-tight">2. Peak Latency 2500ms</span>
                <span className="text-[10px] text-stone-500">Uji ketahanan double-tap</span>
              </div>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${chaosConfig.bad_network_latency_ms > 0 ? 'bg-amber-500' : 'bg-stone-300'}`}>
              <div className={`w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${chaosConfig.bad_network_latency_ms > 0 ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </div>

          {/* Toggle 3: Bluetooth Printer Disconnected */}
          <div
            onClick={handleTogglePrinter}
            className={`cursor-pointer select-none p-3 rounded-2xl border transition-all flex items-center justify-between ${
              chaosConfig.printer_status !== 'CONNECTED'
                ? 'bg-orange-50 border-orange-300 text-orange-900 ring-2 ring-orange-200/60 shadow-sm'
                : 'bg-stone-50 hover:bg-stone-100/70 border-stone-200 text-stone-700'
            }`}
          >
            <div className="flex items-center gap-2.5 pr-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${chaosConfig.printer_status !== 'CONNECTED' ? 'bg-orange-500 text-white' : 'bg-stone-200 text-stone-500'}`}>
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold block leading-tight">3. Printer Disconnect</span>
                <span className="text-[10px] text-stone-500">Uji struk antri reprint</span>
              </div>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${chaosConfig.printer_status !== 'CONNECTED' ? 'bg-orange-500' : 'bg-stone-300'}`}>
              <div className={`w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${chaosConfig.printer_status !== 'CONNECTED' ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </div>

          {/* Toggle 4: Backend 500 DB Lock */}
          <div
            onClick={handleToggleDBLock}
            className={`cursor-pointer select-none p-3 rounded-2xl border transition-all flex items-center justify-between ${
              chaosConfig.db_lock_simulated
                ? 'bg-rose-50 border-rose-300 text-rose-900 ring-2 ring-rose-200/60 shadow-sm'
                : 'bg-stone-50 hover:bg-stone-100/70 border-stone-200 text-stone-700'
            }`}
          >
            <div className="flex items-center gap-2.5 pr-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${chaosConfig.db_lock_simulated ? 'bg-rose-600 text-white' : 'bg-stone-200 text-stone-500'}`}>
                <Database className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold block leading-tight">4. Backend 500 DB Lock</span>
                <span className="text-[10px] text-stone-500">Simulasi deadlock server</span>
              </div>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${chaosConfig.db_lock_simulated ? 'bg-rose-600' : 'bg-stone-300'}`}>
              <div className={`w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${chaosConfig.db_lock_simulated ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Structured Diagnostic Log Inspector Section */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#fffcf9]">
        {/* Log Filters & Controls Bar */}
        <div className="p-3 border-b border-orange-100 bg-white flex flex-wrap items-center justify-between gap-2">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
            {(['ALL', 'NETWORK', 'HARDWARE', 'UX_BEHAVIOR', 'BACKEND'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-xl font-bold transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-orange-500 text-white shadow-2xs shadow-orange-500/20'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                {cat === 'ALL' ? t.logs_filter_all : `[${cat}]`}
              </button>
            ))}
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Cari log..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-stone-50 border border-stone-200 rounded-xl pl-7 pr-2.5 py-1 text-xs text-stone-800 focus:outline-none focus:border-orange-400 w-32 placeholder:text-stone-400"
              />
            </div>
            <button
              onClick={handleExportJSON}
              title="Ekspor log ke JSON"
              className="p-1.5 rounded-xl bg-white hover:bg-orange-50 text-stone-600 hover:text-orange-600 border border-stone-200 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClearLogs}
              title="Bersihkan log"
              className="p-1.5 rounded-xl bg-white hover:bg-rose-50 text-stone-600 hover:text-rose-600 border border-stone-200 transition-colors shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Structured Log Stream Viewer */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 font-mono text-[11px] bg-[#faf6f0]/70">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-stone-400 text-xs py-10 font-sans">
              {t.logs_empty}
            </div>
          ) : (
            filteredLogs.map((log) => {
              const explanation = getRootCauseExplanation(log);

              const catColor =
                log.category === 'NETWORK'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : log.category === 'HARDWARE'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : log.category === 'UX_BEHAVIOR'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200';

              const timeStr =
                new Date(log.timestamp).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                }) +
                `.${new Date(log.timestamp)
                  .getMilliseconds()
                  .toString()
                  .padStart(3, '0')}`;

              return (
                <div
                  key={log.id}
                  className="p-3 rounded-2xl border border-stone-200/90 bg-white hover:border-orange-200 space-y-1.5 transition-all shadow-2xs"
                >
                  {/* Top Bar: Timestamp, Category, Latency */}
                  <div className="flex items-center justify-between text-[10px] text-stone-500">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-stone-400">{timeStr}</span>
                      <span className={`px-2 py-0.5 rounded-lg border font-extrabold uppercase tracking-wider ${catColor}`}>
                        [{log.category}]
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {log.latency_ms > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-bold border border-stone-200">
                          {log.latency_ms}ms
                        </span>
                      )}
                      <span className="text-stone-400 uppercase font-extrabold text-[9px]">{log.level}</span>
                    </div>
                  </div>

                  {/* Log Message */}
                  <div className="text-stone-800 leading-relaxed font-sans text-xs font-medium">
                    {log.message}
                  </div>

                  {/* Automated Root-Cause Diagnosis Box */}
                  {explanation && (
                    <div className="p-2.5 rounded-xl bg-orange-50/70 border border-orange-200/80 text-[11px] text-stone-700 flex items-start gap-2 font-sans shadow-2xs">
                      <HelpCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-extrabold text-orange-900 block">Root-Cause Diagnosis:</span>
                        <span className="text-stone-600">{explanation}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
