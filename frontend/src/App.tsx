import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  MenuItem,
  Order,
  Language,
  ChaosConfig,
  DiagnosticLog,
  KDSStatus,
} from './types';
import { Navbar, type ViewMode } from './components/Navbar';
import { Column1_POS } from './components/Column1_POS';
import { Column2_KDS } from './components/Column2_KDS';
import { Column3_ChaosSandbox } from './components/Column3_ChaosSandbox';
import { ReceiptModal } from './components/ReceiptModal';
import { WelcomeGuideModal } from './components/WelcomeGuideModal';
import { InteractiveTour } from './components/InteractiveTour';
import { api, setClientChaosConfig } from './services/api';
import {
  getOfflineQueue,
  enqueueOfflineOrder,
  clearOfflineQueue,
} from './services/offlineQueue';
import type { QueuedOfflineItem } from './services/offlineQueue';
import { playSuccessChime, playWarningBeep } from './utils/sound';

export const App: React.FC = () => {
  // Application State
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('restopulse_lang');
    if (saved === 'id' || saved === 'en' || saved === 'zh') {
      return saved;
    }
    return 'en'; // Default language: English
  });

  const setLanguage = (lang: Language) => {
    localStorage.setItem('restopulse_lang', lang);
    setLanguageState(lang);
  };
  const [tableNumber, setTableNumber] = useState<string>('T-01');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [chaosConfig, setChaosConfig] = useState<ChaosConfig>({
    wifi_offline: false,
    bad_network_latency_ms: 0,
    printer_status: 'CONNECTED',
    db_lock_simulated: false,
  });
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [unsyncedQueue, setUnsyncedQueue] = useState<QueuedOfflineItem[]>([]);
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<Order | null>(null);
  const [blockedTapsCount, setBlockedTapsCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(() => {
    return localStorage.getItem('restopulse_onboarding_dismissed') !== 'true';
  });
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);

  // 2 Dedicated View Modes: 'client' (POS & KDS) vs 'sandbox' (Chaos & Logs) + 'split' (3 columns)
  const [viewMode, setViewMode] = useState<ViewMode>('client');

  const prevWifiOfflineRef = useRef<boolean>(false);

  // Check if any chaos toggle is active
  const hasActiveChaos =
    chaosConfig.wifi_offline ||
    chaosConfig.bad_network_latency_ms > 0 ||
    chaosConfig.printer_status !== 'CONNECTED' ||
    chaosConfig.db_lock_simulated;

  // Helper to append a diagnostic log locally & persist to backend if online
  const logEvent = useCallback(
    async (
      category: 'NETWORK' | 'HARDWARE' | 'UX_BEHAVIOR' | 'BACKEND',
      rootCause: string,
      latencyMs: number,
      message: string,
      level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' = 'INFO'
    ) => {
      const newLog: DiagnosticLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        category,
        level,
        root_cause: rootCause,
        latency_ms: latencyMs,
        message,
      };

      setLogs((prev) => [newLog, ...prev.slice(0, 199)]);

      if (!chaosConfig.wifi_offline) {
        try {
          await api.sendLog({
            category,
            level,
            root_cause: rootCause,
            latency_ms: latencyMs,
            message,
          });
        } catch {
          // Ignore background sync errors
        }
      }
    },
    [chaosConfig.wifi_offline]
  );

  // Load Initial Data
  const loadInitialData = useCallback(async () => {
    try {
      const [menuData, ordersData, chaosData, logsData] = await Promise.allSettled([
        api.getMenu(),
        api.getOrders(),
        api.getChaosConfig(),
        api.getLogs(),
      ]);

      if (menuData.status === 'fulfilled') setMenuItems(menuData.value);
      if (ordersData.status === 'fulfilled') setOrders(ordersData.value);
      if (chaosData.status === 'fulfilled') {
        setChaosConfig(chaosData.value);
        setClientChaosConfig(chaosData.value);
      }
      if (logsData.status === 'fulfilled') setLogs(logsData.value);
    } catch {
      // Offline on boot fallback
    }

    setUnsyncedQueue(getOfflineQueue());
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Periodic polling for live KDS tickets & Logs (only when simulated online)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (chaosConfig.wifi_offline) return;
      try {
        const [latestOrders, latestLogs] = await Promise.allSettled([
          api.getOrders(),
          api.getLogs(),
        ]);
        if (latestOrders.status === 'fulfilled') {
          // Merge with any local unsynced offline orders
          const offlineItems = getOfflineQueue().map((q) => q.order);
          const combined = [...offlineItems];
          for (const ord of latestOrders.value) {
            if (!combined.some((o) => o.id === ord.id || o.idempotency_key === ord.idempotency_key)) {
              combined.push(ord);
            }
          }
          setOrders(combined);
        }
        if (latestLogs.status === 'fulfilled') {
          setLogs(latestLogs.value);
        }
      } catch {
        // Suppress polling error during latency or chaos
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [chaosConfig.wifi_offline]);

  // Offline Sync Reconciliation Handler
  const handleSyncOffline = useCallback(async () => {
    const currentQueue = getOfflineQueue();
    if (currentQueue.length === 0 || chaosConfig.wifi_offline || isSyncing) return;

    setIsSyncing(true);
    const startSync = Date.now();

    try {
      const payloads = currentQueue.map((q) => q.payload);
      const res = await api.batchSyncOrders(payloads);

      // Clear local storage queue
      clearOfflineQueue();
      setUnsyncedQueue([]);

      // Fetch fresh orders from server
      const freshOrders = await api.getOrders();
      setOrders(freshOrders);

      playSuccessChime();
      const elapsed = Date.now() - startSync;
      logEvent(
        'NETWORK',
        'BATCH_SYNC_RESOLVED',
        elapsed,
        `[NETWORK_RESTORED] Auto-reconciliation complete: ${res.synced_count} offline orders synced, ${res.duplicates_skipped} duplicates skipped.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logEvent('NETWORK', 'BATCH_SYNC_FAILED', 0, `Batch sync failed: ${msg}`, 'ERROR');
    } finally {
      setIsSyncing(false);
    }
  }, [chaosConfig.wifi_offline, isSyncing, logEvent]);

  // Auto-detect WiFi restoration: when wifi_offline transitions from true to false
  useEffect(() => {
    if (prevWifiOfflineRef.current && !chaosConfig.wifi_offline) {
      // WiFi just came back online! Flush offline queue immediately
      const queue = getOfflineQueue();
      if (queue.length > 0) {
        logEvent(
          'NETWORK',
          'WIFI_CONNECTION_RESTORED',
          15,
          `Restaurant WiFi connection restored. Flushing ${queue.length} queued offline orders to Go backend...`
        );
        handleSyncOffline();
      }
    }
    prevWifiOfflineRef.current = chaosConfig.wifi_offline;
  }, [chaosConfig.wifi_offline, handleSyncOffline, logEvent]);

  // Order Placement Handler (with Optimistic UI & Hardware Resilience)
  const handleOrderPlaced = async (optimisticOrder: Order, isOffline: boolean) => {
    const start = Date.now();

    // 1. Immediately inject optimistic order into UI orders state (<50ms)
    setOrders((prev) => [optimisticOrder, ...prev]);

    const payload = {
      idempotency_key: optimisticOrder.idempotency_key,
      table_number: optimisticOrder.table_number,
      customer_name: optimisticOrder.customer_name,
      payment_method: optimisticOrder.payment_method,
      client_created_at: optimisticOrder.created_at,
      items: optimisticOrder.items.map((it) => ({
        menu_item_id: it.menu_item_id,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        notes: it.notes,
      })),
    };

    // 2. If app is simulated offline, enqueue in LocalStorage immediately
    if (isOffline) {
      enqueueOfflineOrder(optimisticOrder, payload);
      setUnsyncedQueue(getOfflineQueue());

      logEvent(
        'NETWORK',
        'OFFLINE_QUEUE_STORED',
        Date.now() - start,
        `[OFFLINE_RESILIENCE] WiFi is offline. Order ${optimisticOrder.order_number} safely queued in browser LocalStorage. Will sync automatically upon reconnection.`
      );
      return;
    }

    // 3. App is online: Send to Go Backend
    try {
      const res = await api.createOrder(payload, optimisticOrder.idempotency_key);
      const latency = Date.now() - start;

      // Replace optimistic order with server confirmed order
      setOrders((prev) =>
        prev.map((o) => (o.idempotency_key === optimisticOrder.idempotency_key ? res.data : o))
      );

      if (res.idempotent_replay) {
        logEvent(
          'UX_BEHAVIOR',
          'IDEMPOTENCY_DUPLICATE_ABSORBED',
          latency,
          `Idempotency Guard: Backend recognized duplicate key ${optimisticOrder.idempotency_key}. Safe replay returned without double-charging or double kitchen ticket.`,
          'WARN'
        );
      } else {
        logEvent(
          'NETWORK',
          'ORDER_COMMITTED',
          latency,
          `Order ${res.data.order_number} confirmed by Go backend in ${latency}ms (Status: ${res.data.kds_status}).`
        );
      }
    } catch (err: unknown) {
      const latency = Date.now() - start;
      const errorMsg = err instanceof Error ? err.message : String(err);

      // Check if Backend 500 DB Lock was encountered
      if (errorMsg.includes('deadlock') || errorMsg.includes('database is locked') || errorMsg.includes('500')) {
        playWarningBeep();
        logEvent(
          'BACKEND',
          'SIMULATED_DB_LOCK',
          latency,
          `[BACKEND_FAILURE] HTTP 500 Internal Server Error: pq: deadlock detected / sqlite3: database is locked. Customer cart preserved.`,
          'CRITICAL'
        );
        // Mark order in KDS as cancelled/failed
        setOrders((prev) =>
          prev.map((o) =>
            o.idempotency_key === optimisticOrder.idempotency_key
              ? { ...o, kds_status: 'CANCELLED' }
              : o
          )
        );
      } else {
        // Unexpected network error: fallback gracefully to offline queue!
        enqueueOfflineOrder(optimisticOrder, payload);
        setUnsyncedQueue(getOfflineQueue());
        logEvent(
          'NETWORK',
          'NETWORK_FALLBACK_OFFLINE',
          latency,
          `Network dropped during dispatch (${errorMsg}). Order automatically routed to LocalStorage offline queue.`
        );
      }
    }
  };

  // KDS Status Transition
  const handleUpdateKDSStatus = async (orderId: string, newStatus: KDSStatus) => {
    // Optimistic status update
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, kds_status: newStatus } : o))
    );

    if (!chaosConfig.wifi_offline) {
      try {
        await api.updateKDSStatus(orderId, newStatus);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logEvent('BACKEND', 'KDS_UPDATE_ERROR', 0, `KDS update error: ${msg}`, 'ERROR');
      }
    }
  };

  // Reprint Receipt
  const handleReprintReceipt = async (orderId: string) => {
    if (chaosConfig.printer_status !== 'CONNECTED') {
      playWarningBeep();
      logEvent(
        'HARDWARE',
        'REPRINT_BLOCKED_PRINTER_OFFLINE',
        0,
        `Cannot reprint receipt: Thermal printer status is '${chaosConfig.printer_status}'. Connect printer first!`,
        'WARN'
      );
      return;
    }

    try {
      const updated = await api.reprintReceipt(orderId);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      if (selectedReceiptOrder?.id === orderId) {
        setSelectedReceiptOrder(updated);
      }
      playSuccessChime();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logEvent('HARDWARE', 'REPRINT_ERROR', 0, `Reprint failed: ${msg}`, 'ERROR');
    }
  };

  // Chaos Toggles Update
  const handleUpdateChaos = async (updated: Partial<ChaosConfig>) => {
    const nextConfig = { ...chaosConfig, ...updated };
    setChaosConfig(nextConfig);
    setClientChaosConfig(nextConfig);

    try {
      await api.updateChaosConfig(nextConfig);
    } catch {
      // If offline, updated in client memory
    }
  };

  // Clear Logs
  const handleClearLogs = async () => {
    setLogs([]);
    try {
      await api.clearLogs();
    } catch {
      // Ignore
    }
  };

  return (
    <div className="h-screen max-h-screen bg-[#fffaf5] text-stone-800 flex flex-col font-sans selection:bg-orange-500 selection:text-white overflow-hidden">
      {/* Top Navigation Bar (Fixed height) */}
      <div className="flex-shrink-0">
        <Navbar
          language={language}
          setLanguage={setLanguage}
          tableNumber={tableNumber}
          setTableNumber={setTableNumber}
          isOffline={chaosConfig.wifi_offline}
          unsyncedCount={unsyncedQueue.length}
          onSyncOffline={handleSyncOffline}
          isSyncing={isSyncing}
          viewMode={viewMode}
          setViewMode={setViewMode}
          hasActiveChaos={hasActiveChaos}
          onOpenGuide={() => setIsGuideOpen(true)}
          onStartTour={() => setIsTourOpen(true)}
        />
      </div>

      {/* Main Dynamic View Area (Takes remaining viewport height) */}
      <main className="flex-1 min-h-0 max-w-[1920px] w-full mx-auto p-3 sm:p-4 overflow-hidden">
        {/* TAMPILAN 1: OPERASIONAL RESTORAN (CLIENT VIEW: POS & KDS) */}
        {viewMode === 'client' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full min-h-0">
            {/* Left: POS / QR Ordering */}
            <section className="h-full min-h-0 flex flex-col overflow-hidden">
              <Column1_POS
                language={language}
                menuItems={menuItems}
                tableNumber={tableNumber}
                onOrderPlaced={handleOrderPlaced}
                onLogEvent={logEvent}
                isSimulatedOffline={chaosConfig.wifi_offline}
                onViewReceipt={(order) => setSelectedReceiptOrder(order)}
                onRecordRapidDoubleTap={() => setBlockedTapsCount((c) => c + 1)}
              />
            </section>

            {/* Right: Kitchen Display System (KDS) & Hardware Status */}
            <section className="h-full min-h-0 flex flex-col overflow-hidden">
              <Column2_KDS
                language={language}
                orders={orders}
                printerStatus={chaosConfig.printer_status}
                onUpdateStatus={handleUpdateKDSStatus}
                onReprintReceipt={handleReprintReceipt}
                onViewReceipt={(order) => setSelectedReceiptOrder(order)}
              />
            </section>
          </div>
        )}

        {/* TAMPILAN 2: KONFIGURASI SANDBOX & LOGS (FIELD ENGINEER SANDBOX VIEW) */}
        {viewMode === 'sandbox' && (
          <div className="h-full min-h-0 max-w-5xl mx-auto w-full flex flex-col overflow-hidden">
            <Column3_ChaosSandbox
              language={language}
              chaosConfig={chaosConfig}
              onUpdateChaos={handleUpdateChaos}
              logs={logs}
              onClearLogs={handleClearLogs}
              blockedTapsCount={blockedTapsCount}
              unsyncedCount={unsyncedQueue.length}
              totalOrdersCount={orders.length}
            />
          </div>
        )}

        {/* OPTIONAL VIEW: 3-COLUMN SPLIT (ALL IN ONE) */}
        {viewMode === 'split' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full min-h-0">
            <section className="h-full min-h-0 flex flex-col overflow-hidden">
              <Column1_POS
                language={language}
                menuItems={menuItems}
                tableNumber={tableNumber}
                onOrderPlaced={handleOrderPlaced}
                onLogEvent={logEvent}
                isSimulatedOffline={chaosConfig.wifi_offline}
                onViewReceipt={(order) => setSelectedReceiptOrder(order)}
                onRecordRapidDoubleTap={() => setBlockedTapsCount((c) => c + 1)}
              />
            </section>

            <section className="h-full min-h-0 flex flex-col overflow-hidden">
              <Column2_KDS
                language={language}
                orders={orders}
                printerStatus={chaosConfig.printer_status}
                onUpdateStatus={handleUpdateKDSStatus}
                onReprintReceipt={handleReprintReceipt}
                onViewReceipt={(order) => setSelectedReceiptOrder(order)}
              />
            </section>

            <section className="h-full min-h-0 flex flex-col overflow-hidden">
              <Column3_ChaosSandbox
                language={language}
                chaosConfig={chaosConfig}
                onUpdateChaos={handleUpdateChaos}
                logs={logs}
                onClearLogs={handleClearLogs}
                blockedTapsCount={blockedTapsCount}
                unsyncedCount={unsyncedQueue.length}
                totalOrdersCount={orders.length}
              />
            </section>
          </div>
        )}
      </main>

      {/* Thermal Receipt Preview Modal */}
      <ReceiptModal
        order={selectedReceiptOrder}
        onClose={() => setSelectedReceiptOrder(null)}
        onReprint={handleReprintReceipt}
        language={language}
      />

      {/* Onboarding Welcome & Baby Steps Guide Modal */}
      <WelcomeGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        language={language}
        onNavigateScenario={(mode) => setViewMode(mode)}
        onStartTour={() => setIsTourOpen(true)}
      />

      {/* Interactive Spotlight Guided Tour (Button & Element Highlighting) */}
      <InteractiveTour
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        language={language}
        currentViewMode={viewMode}
        onSetViewMode={(mode) => setViewMode(mode)}
      />
    </div>
  );
};

export default App;
