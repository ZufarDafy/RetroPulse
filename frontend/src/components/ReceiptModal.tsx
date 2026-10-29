import React from 'react';
import type { Order, Language } from '../types';
import { UI_TRANSLATIONS } from '../utils/translations';
import { X, Printer, CheckCircle, AlertTriangle, QrCode } from 'lucide-react';

interface ReceiptModalProps {
  order: Order | null;
  onClose: () => void;
  onReprint?: (orderId: string) => void;
  language: Language;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  order,
  onClose,
  onReprint,
  language,
}) => {
  if (!order) return null;
  const t = UI_TRANSLATIONS[language];

  const subtotal = order.items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const tax = subtotal * 0.10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-sm bg-white text-stone-800 rounded-3xl shadow-2xl overflow-hidden font-mono text-xs border border-orange-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Paper receipt header */}
        <div className="p-6 text-center border-b border-dashed border-stone-200 bg-orange-50/50">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-orange-100 text-orange-600 mb-2 shadow-xs">
            <Printer className="w-5 h-5" />
          </div>
          <h2 className="text-base font-extrabold tracking-tight text-stone-900">
            RESTOPULSE BISTRO & CAFE
          </h2>
          <p className="text-[11px] text-stone-500 font-sans">Jl. Ir. H. Djuanda No. 99, Dago, Bandung</p>
          <p className="text-[10px] text-stone-400 mt-0.5">Tel: +62 22 2501234 · NPWPD: 01.234.567.8</p>
        </div>

        {/* Order Details */}
        <div className="px-6 py-4 border-b border-dashed border-stone-200 space-y-1.5 text-stone-600 bg-white">
          <div className="flex justify-between font-bold text-stone-900">
            <span>{t.order_no}:</span>
            <span className="text-orange-600">{order.order_number}</span>
          </div>
          <div className="flex justify-between">
            <span>{t.table_label}:</span>
            <span className="font-bold text-stone-800">{order.table_number}</span>
          </div>
          <div className="flex justify-between">
            <span>{language === 'id' ? 'Waktu:' : language === 'zh' ? '时间:' : 'Time:'}</span>
            <span>{new Date(order.created_at).toLocaleTimeString(language === 'id' ? 'id-ID' : language === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
          <div className="flex justify-between">
            <span>{t.payment_method}:</span>
            <span className="font-bold text-emerald-700">{order.payment_method} ({language === 'id' ? 'LUNAS' : language === 'zh' ? '已支付' : 'PAID'})</span>
          </div>
          <div className="flex justify-between text-[10px] text-stone-400 truncate">
            <span>Key:</span>
            <span className="truncate max-w-[170px]">{order.idempotency_key}</span>
          </div>
        </div>

        {/* Item List */}
        <div className="px-6 py-4 border-b border-dashed border-stone-200 space-y-2 max-h-52 overflow-y-auto bg-stone-50/40">
          {order.items.map((item, idx) => (
            <div key={idx} className="space-y-0.5">
              <div className="flex justify-between text-stone-900 font-bold">
                <span>{item.name}</span>
                <span>Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-stone-500 text-[11px]">
                <span>{item.quantity} x Rp {item.price.toLocaleString('id-ID')}</span>
                {item.notes && <span className="text-orange-700 italic max-w-[140px] truncate font-sans">({item.notes})</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="px-6 py-4 border-b border-dashed border-stone-200 space-y-1.5 bg-white">
          <div className="flex justify-between text-stone-600">
            <span>{t.subtotal}:</span>
            <span>Rp {subtotal.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between text-stone-600">
            <span>{t.tax}:</span>
            <span>Rp {tax.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between text-stone-900 font-extrabold text-sm pt-1 border-t border-stone-200">
            <span>{t.total}:</span>
            <span className="text-orange-600">Rp {order.total_amount.toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* Mock QRIS Stamp */}
        <div className="p-4 bg-orange-50/30 text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <QrCode className="w-8 h-8 text-stone-800" />
            <div className="text-left font-sans">
              <span className="block font-bold text-[10px] uppercase tracking-wider text-stone-800">
                QRIS Terverifikasi
              </span>
              <span className="text-[9px] text-stone-400">NMID: ID1020039482910</span>
            </div>
          </div>

          {/* Status Badge */}
          {order.print_status === 'PRINTED' ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Struk Dicetak Fisik (Bluetooth OK)</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-300 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>{t.receipt_queued_badge}</span>
              </div>
              {onReprint && (
                <div>
                  <button
                    onClick={() => onReprint(order.id)}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs shadow-xs"
                  >
                    <Printer className="w-3 h-3" />
                    <span>{t.btn_reprint}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Receipt Footer */}
        <div className="p-3 text-center bg-stone-100 text-[10px] text-stone-500 border-t border-stone-200 font-sans">
          Terima kasih atas kunjungan Anda! Silakan berkunjung kembali.
        </div>
      </div>
    </div>
  );
};
