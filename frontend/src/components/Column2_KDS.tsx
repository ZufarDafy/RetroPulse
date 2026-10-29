import React, { useState, useEffect } from 'react';
import type { Order, Language, KDSStatus } from '../types';
import { UI_TRANSLATIONS } from '../utils/translations';
import { playTapSound, playKitchenBell } from '../utils/sound';
import {
  ChefHat,
  Printer,
  QrCode,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Check,
  RotateCcw,
} from 'lucide-react';

interface Column2KDSProps {
  language: Language;
  orders: Order[];
  printerStatus: 'CONNECTED' | 'PAPER_OUT' | 'DISCONNECTED';
  onUpdateStatus: (orderId: string, status: KDSStatus) => void;
  onReprintReceipt: (orderId: string) => void;
  onViewReceipt: (order: Order) => void;
}

export const Column2_KDS: React.FC<Column2KDSProps> = ({
  language,
  orders,
  printerStatus,
  onUpdateStatus,
  onReprintReceipt,
  onViewReceipt,
}) => {
  const t = UI_TRANSLATIONS[language];
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PREPARING' | 'SERVED'>('ALL');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // Dynamic ticking clock for orders
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleItemCheck = (key: string) => {
    playTapSound();
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getElapsedTime = (createdAt: string) => {
    const start = new Date(createdAt).getTime();
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - start) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === 'ALL') return true;
    return o.kds_status === filter;
  });

  const pendingCount = orders.filter((o) => o.kds_status === 'PENDING').length;
  const preparingCount = orders.filter((o) => o.kds_status === 'PREPARING').length;
  const servedCount = orders.filter((o) => o.kds_status === 'SERVED').length;

  return (
    <div data-tour="kds-column" className="flex flex-col h-full min-h-0 bg-white rounded-3xl border border-orange-100 shadow-md shadow-orange-950/5 overflow-hidden transition-all">
      {/* Column Header */}
      <div className="flex-shrink-0 p-4 border-b border-orange-100 bg-gradient-to-r from-orange-50/80 to-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
            <ChefHat className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-stone-900 tracking-tight">
              {t.col2_title}
            </h2>
            <p className="text-xs text-stone-500">{t.col2_subtitle}</p>
          </div>
        </div>

        {/* Live Queue Counter */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold shadow-2xs">
            {pendingCount} {t.kds_pending}
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 font-bold shadow-2xs">
            {preparingCount} {t.kds_preparing}
          </span>
        </div>
      </div>

      {/* Mock Hardware Status Bar */}
      <div data-tour="kds-hardware-bar" className="flex-shrink-0 px-4 py-2.5 bg-[#fffcf9] border-b border-orange-100/70 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Bluetooth Thermal Printer */}
        <div className="flex items-center gap-2">
          <span className="text-stone-500 font-medium">{t.hardware_printer}:</span>
          {printerStatus === 'CONNECTED' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <Printer className="w-3 h-3" />
              <span>{t.connected}</span>
            </span>
          ) : printerStatus === 'PAPER_OUT' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-300 text-[11px] font-bold animate-pulse">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span>{t.paper_out}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-300 text-[11px] font-bold animate-pulse">
              <AlertTriangle className="w-3 h-3 text-rose-500" />
              <span>{t.disconnected}</span>
            </span>
          )}
        </div>

        {/* QRIS Gateway Status */}
        <div className="flex items-center gap-2">
          <span className="text-stone-500 font-medium">{t.hardware_gateway}:</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
            <QrCode className="w-3 h-3 text-emerald-600" />
            <span>{t.operational}</span>
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-stone-100 flex items-center gap-1.5 bg-stone-50/60 text-xs">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1 rounded-xl font-bold transition-all ${
            filter === 'ALL'
              ? 'bg-orange-500 text-white shadow-xs shadow-orange-500/20'
              : 'text-stone-600 hover:text-stone-900 hover:bg-white'
          }`}
        >
          {t.kds_filter_all} ({orders.length})
        </button>
        <button
          onClick={() => setFilter('PENDING')}
          className={`px-3 py-1 rounded-xl font-bold transition-all ${
            filter === 'PENDING'
              ? 'bg-rose-500 text-white shadow-xs'
              : 'text-stone-600 hover:text-rose-600 hover:bg-white'
          }`}
        >
          {t.kds_pending} ({pendingCount})
        </button>
        <button
          onClick={() => setFilter('PREPARING')}
          className={`px-3 py-1 rounded-xl font-bold transition-all ${
            filter === 'PREPARING'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-stone-600 hover:text-amber-600 hover:bg-white'
          }`}
        >
          {t.kds_preparing} ({preparingCount})
        </button>
        <button
          onClick={() => setFilter('SERVED')}
          className={`px-3 py-1 rounded-xl font-bold transition-all ${
            filter === 'SERVED'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-stone-600 hover:text-emerald-600 hover:bg-white'
          }`}
        >
          {t.kds_served} ({servedCount})
        </button>
      </div>

      {/* Order Tickets Stream (Only this section scrolls!) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 bg-[#fffcf9]/60 overscroll-contain">
        {filteredOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-stone-400 text-xs space-y-2 py-12">
            <ChefHat className="w-12 h-12 stroke-1 text-stone-300" />
            <p className="font-medium">{t.kds_empty_tickets}</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const isPending = order.kds_status === 'PENDING';
            const isPreparing = order.kds_status === 'PREPARING';
            const isServed = order.kds_status === 'SERVED';
            const isReprintQueued = order.print_status === 'QUEUED_FOR_REPRINT';

            return (
              <div
                key={order.id}
                className={`relative rounded-2xl border p-4 transition-all shadow-sm ${
                  isPending
                    ? 'bg-rose-50/30 border-rose-200 ring-2 ring-rose-100/80 shadow-rose-950/5'
                    : isPreparing
                    ? 'bg-amber-50/30 border-amber-200 ring-2 ring-amber-100/80 shadow-amber-950/5'
                    : 'bg-white border-stone-200 opacity-80'
                }`}
              >
                {/* Header: Order Number, Table, Status, Timer */}
                <div className="flex items-center justify-between pb-2.5 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-base text-stone-900">
                      {order.order_number}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-orange-100 text-orange-700 font-extrabold text-xs">
                      {order.table_number}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Cooking Timer */}
                    <div className="flex items-center gap-1 text-[11px] font-mono text-stone-500 font-semibold bg-white px-2 py-0.5 rounded-md border border-stone-200">
                      <Clock className="w-3 h-3 text-stone-400" />
                      <span>{getElapsedTime(order.created_at)}</span>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        isPending
                          ? 'bg-rose-100 text-rose-700 animate-pulse'
                          : isPreparing
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {isPending ? t.kds_pending : isPreparing ? t.kds_preparing : t.kds_served}
                    </span>
                  </div>
                </div>

                {/* Offline Sync Badge if relevant */}
                {order.sync_status === 'QUEUED_OFFLINE' && (
                  <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-amber-100/80 border border-amber-300 flex items-center justify-between text-[11px] text-amber-900 font-medium">
                    <span className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>{t.unsynced_badge}</span>
                    </span>
                    <span className="text-[10px] text-amber-700">{t.kds_auto_sync_hint}</span>
                  </div>
                )}

                {/* Hardware Warning: Receipt Queued for Reprint */}
                {isReprintQueued && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-between text-xs text-amber-900 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 animate-bounce" />
                      <div>
                        <span className="font-bold block text-[11px]">{t.receipt_queued_badge}</span>
                        <span className="text-[10px] text-amber-700">{t.kds_printer_offline_hint}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onReprintReceipt(order.id)}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 shadow-xs transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{t.btn_reprint}</span>
                    </button>
                  </div>
                )}

                {/* Item List with Chef Checklist */}
                <div className="py-3 space-y-2">
                  {order.items.map((item, idx) => {
                    const itemKey = `${order.id}-${idx}`;
                    const isChecked = checkedItems[itemKey];

                    return (
                      <div
                        key={idx}
                        onClick={() => toggleItemCheck(itemKey)}
                        className={`cursor-pointer group flex items-start justify-between p-2 rounded-xl transition-colors text-xs ${
                          isChecked
                            ? 'bg-stone-100 text-stone-400 line-through'
                            : 'hover:bg-orange-50/50 text-stone-800'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={!!isChecked}
                            onChange={() => {}}
                            className="mt-0.5 rounded border-stone-300 text-orange-500 focus:ring-0 w-4 h-4"
                          />
                          <div>
                            <span className="font-bold text-stone-900 group-hover:text-orange-600">
                              {item.name}
                            </span>
                            {item.notes && (
                              <p className="text-[10px] text-orange-600 italic font-medium">
                                * {item.notes}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="font-mono font-bold text-orange-700 text-xs px-2 py-0.5 bg-orange-50 rounded-lg border border-orange-200">
                          x{item.quantity}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Controls: Transitions (Pending -> Preparing -> Served) */}
                <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs">
                  <button
                    onClick={() => onViewReceipt(order)}
                    className="text-stone-500 hover:text-orange-600 text-[11px] font-semibold underline"
                  >
                    {t.view_receipt}
                  </button>

                  <div className="flex items-center gap-2">
                    {isPending && (
                      <button
                        onClick={() => {
                          playKitchenBell();
                          onUpdateStatus(order.id, 'PREPARING');
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs transition-colors active:scale-95"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{t.action_start_cooking}</span>
                      </button>
                    )}

                    {isPreparing && (
                      <button
                        onClick={() => {
                          playKitchenBell();
                          onUpdateStatus(order.id, 'SERVED');
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{t.action_mark_served}</span>
                      </button>
                    )}

                    {isServed && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{t.kds_served}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
