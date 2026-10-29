import React, { useState, useEffect, useRef } from 'react';
import type { MenuItem, CartItem, Order, Language } from '../types';
import { UI_TRANSLATIONS } from '../utils/translations';
import { generateIdempotencyKey } from '../utils/idempotency';
import { playTapSound, playSuccessChime, playWarningBeep } from '../utils/sound';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Key,
  ShieldAlert,
  Sparkles,
  Receipt,
  Check,
  CreditCard,
  Utensils,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Column1POSProps {
  language: Language;
  menuItems: MenuItem[];
  tableNumber: string;
  onOrderPlaced: (order: Order, isOffline: boolean) => void;
  onLogEvent: (
    category: 'NETWORK' | 'HARDWARE' | 'UX_BEHAVIOR' | 'BACKEND',
    rootCause: string,
    latencyMs: number,
    message: string,
    level?: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'
  ) => void;
  isSimulatedOffline: boolean;
  onViewReceipt: (order: Order) => void;
  onRecordRapidDoubleTap: () => void;
}

export const Column1_POS: React.FC<Column1POSProps> = ({
  language,
  menuItems,
  tableNumber,
  onOrderPlaced,
  onLogEvent,
  isSimulatedOffline,
  onViewReceipt,
  onRecordRapidDoubleTap,
}) => {
  const t = UI_TRANSLATIONS[language];

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  // Idempotency Intent Key: Generated once per order composition
  const [currentIdempotencyKey, setCurrentIdempotencyKey] = useState<string>('');

  // Double-tap prevention guard
  const lastTapTimeRef = useRef<number>(0);
  const [isCheckoutLocked, setIsCheckoutLocked] = useState<boolean>(false);
  const [rapidTapAlert, setRapidTapAlert] = useState<boolean>(false);

  // Optimistic UI state
  const [optimisticFlash, setOptimisticFlash] = useState<boolean>(false);
  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);

  // Generate idempotency key on mount or whenever cart is cleared
  useEffect(() => {
    if (!currentIdempotencyKey) {
      setCurrentIdempotencyKey(generateIdempotencyKey());
    }
  }, [currentIdempotencyKey]);

  // Extract distinct categories
  const categories = ['ALL', ...Array.from(new Set(menuItems.map((m) => m.category[language])))];

  // Reset active category on language switch
  useEffect(() => {
    setActiveCategory('ALL');
  }, [language]);

  const filteredMenu =
    activeCategory === 'ALL'
      ? menuItems
      : menuItems.filter((m) => m.category[language] === activeCategory);

  // Cart actions
  const addToCart = (item: MenuItem) => {
    playTapSound();
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.menuItem.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx].quantity += 1;
        return next;
      }
      return [...prev, { menuItem: item, quantity: 1, notes: '' }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    playTapSound();
    setCart((prev) => {
      return prev
        .map((c) => {
          if (c.menuItem.id === itemId) {
            const nextQty = c.quantity + delta;
            return nextQty > 0 ? { ...c, quantity: nextQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const updateNotes = (itemId: string, notes: string) => {
    setCart((prev) =>
      prev.map((c) => (c.menuItem.id === itemId ? { ...c, notes } : c))
    );
  };

  const clearCart = () => {
    setCart([]);
    setCurrentIdempotencyKey(generateIdempotencyKey());
  };

  // Calculations
  const subtotal = cart.reduce((acc, it) => acc + it.menuItem.price * it.quantity, 0);
  const tax = subtotal * 0.10;
  const grandTotal = subtotal + tax;

  // Checkout Handler with Optimistic UI & Rapid Double-Tap Guard
  const handleCheckout = async () => {
    if (cart.length === 0) return;

    const now = Date.now();
    const elapsedSinceLastTap = now - lastTapTimeRef.current;

    // RAPID DOUBLE-TAP DETECTION (Within 1500ms)
    if (elapsedSinceLastTap > 0 && elapsedSinceLastTap < 1500) {
      playWarningBeep();
      setRapidTapAlert(true);
      onRecordRapidDoubleTap();
      onLogEvent(
        'UX_BEHAVIOR',
        'RAPID_DOUBLE_TAP_PREVENTED',
        elapsedSinceLastTap,
        `[UX_FRICTION: Rapid Double-Tap Prevented] User tapped 'Checkout' again after only ${elapsedSinceLastTap}ms. Duplicate click blocked; original intent preserved.`,
        'WARN'
      );
      setTimeout(() => setRapidTapAlert(false), 3000);
      return;
    }

    // Update tap timestamp and lock checkout button
    lastTapTimeRef.current = now;
    setIsCheckoutLocked(true);

    const idempotencyKey = currentIdempotencyKey;
    const clientTimestamp = new Date().toISOString();
    const orderNumber = `#RP-${Math.floor(1000 + Math.random() * 9000)}`;

    // 1. OPTIMISTIC UI FEEDBACK (<50ms)
    playSuccessChime();
    setOptimisticFlash(true);

    const optimisticOrder: Order = {
      id: idempotencyKey,
      idempotency_key: idempotencyKey,
      order_number: orderNumber,
      table_number: tableNumber,
      customer_name: `Pelanggan ${tableNumber}`,
      total_amount: grandTotal,
      payment_method: 'QRIS',
      payment_status: 'PAID',
      kds_status: 'PENDING',
      print_status: 'PRINTED',
      sync_status: isSimulatedOffline ? 'QUEUED_OFFLINE' : 'SYNCED',
      created_at: clientTimestamp,
      updated_at: clientTimestamp,
      isOptimistic: true,
      items: cart.map((c) => ({
        id: `opt-${Math.random()}`,
        order_id: idempotencyKey,
        menu_item_id: c.menuItem.id,
        name: c.menuItem.name[language],
        price: c.menuItem.price,
        quantity: c.quantity,
        notes: c.notes,
        subtotal: c.menuItem.price * c.quantity,
      })),
    };

    setLastPlacedOrder(optimisticOrder);

    // Confetti celebration
    try {
      confetti({
        particleCount: 35,
        spread: 60,
        origin: { y: 0.85, x: 0.25 },
        colors: ['#ea580c', '#f59e0b', '#10b981'],
      });
    } catch {
      // Ignore
    }

    // Reset Cart immediately (<50ms)
    clearCart();

    // 2. DISPATCH ORDER TO PARENT HANDLER
    onOrderPlaced(optimisticOrder, isSimulatedOffline);

    // Release button lock after debounce window
    setTimeout(() => {
      setIsCheckoutLocked(false);
      setOptimisticFlash(false);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white rounded-3xl border border-orange-100 shadow-md shadow-orange-950/5 overflow-hidden transition-all">
      {/* Column Header */}
      <div className="flex-shrink-0 p-4 border-b border-orange-100 bg-gradient-to-r from-orange-50/80 to-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
            <Utensils className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-stone-900 tracking-tight">
              {t.col1_title}
            </h2>
            <p className="text-xs text-stone-500">{t.col1_subtitle}</p>
          </div>
        </div>

        {/* Optimistic UI indicator pill */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-xs font-bold shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-orange-500" />
          <span>{t.optimistic_badge}</span>
        </div>
      </div>

      {/* Rapid Double-Tap Warning Banner */}
      {rapidTapAlert && (
        <div className="flex-shrink-0 bg-rose-50 text-rose-800 text-xs px-4 py-2.5 flex items-center gap-2 border-b border-rose-200 font-semibold animate-bounce">
          <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{t.rapid_tap_warning}</span>
        </div>
      )}

      {/* Category Pills */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-stone-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none bg-[#fffcf9]">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              activeCategory === cat
                ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30'
                : 'bg-white text-stone-600 hover:bg-orange-50 hover:text-orange-700 border border-stone-200/80'
            }`}
          >
            {cat === 'ALL' ? t.category_all : cat}
          </button>
        ))}
      </div>

      {/* Main Content Area: Menu Grid (Top) */}
      <div data-tour="pos-menu-grid" className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 overscroll-contain">
        {/* Menu Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredMenu.map((item) => {
            const inCart = cart.find((c) => c.menuItem.id === item.id);
            return (
              <div
                key={item.id}
                className="group relative bg-white hover:bg-orange-50/30 rounded-2xl p-3 border border-orange-100/90 hover:border-orange-300 hover:shadow-md hover:shadow-orange-950/5 transition-all flex flex-col justify-between shadow-2xs overflow-hidden"
              >
                {/* Image and Badges */}
                <div className="relative h-28 w-full rounded-xl overflow-hidden bg-stone-100 mb-2.5">
                  <img
                    src={item.image_url}
                    alt={item.name[language]}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  {item.badge && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-orange-500 text-white font-extrabold text-[10px] shadow-sm uppercase tracking-wider">
                      {item.badge[language]}
                    </span>
                  )}
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg bg-stone-900/85 backdrop-blur-sm text-white font-mono font-bold text-xs">
                    Rp {item.price.toLocaleString('id-ID')}
                  </span>
                </div>

                {/* Details */}
                <div className="flex-1">
                  <h3 className="text-xs font-bold text-stone-900 line-clamp-1 group-hover:text-orange-600 transition-colors">
                    {item.name[language]}
                  </h3>
                  <p className="text-[11px] text-stone-500 line-clamp-2 mt-0.5 leading-relaxed">
                    {item.description[language]}
                  </p>
                </div>

                {/* Action button */}
                <div className="mt-2.5 pt-2.5 border-t border-stone-100 flex items-center justify-between">
                  <span className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">
                    {item.category[language]}
                  </span>
                  {inCart ? (
                    <div className="flex items-center gap-1.5 bg-orange-50 px-2 py-1 rounded-xl border border-orange-200">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="p-0.5 rounded hover:bg-orange-200/50 text-stone-600"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono font-bold text-xs text-orange-700 w-4 text-center">
                        {inCart.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="p-0.5 rounded hover:bg-orange-200/50 text-stone-600"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(item)}
                      className="flex items-center gap-1 px-3 py-1 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-xs shadow-orange-500/20 active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t.add_to_cart}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Last Placed Order Quick Receipt Banner */}
        {lastPlacedOrder && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between text-xs text-emerald-900 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shadow-xs">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-stone-900">
                  {t.order_label} {lastPlacedOrder.order_number} {lastPlacedOrder.sync_status === 'QUEUED_OFFLINE' ? `(${t.order_offline})` : `(${t.order_sent})`}
                </p>
                <p className="text-[11px] text-stone-500">
                  Total: Rp {lastPlacedOrder.total_amount.toLocaleString('id-ID')} · {lastPlacedOrder.table_number}
                </p>
              </div>
            </div>
            <button
              onClick={() => onViewReceipt(lastPlacedOrder)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>{t.view_receipt}</span>
            </button>
          </div>
        )}
      </div>

      {/* Cart Summary & Checkout Footer */}
      <div data-tour="pos-checkout-section" className="flex-shrink-0 border-t border-orange-100 bg-[#fffdfa] p-4 space-y-3">
        {/* Cart items list */}
        {cart.length > 0 ? (
          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
            <div className="flex items-center justify-between text-xs font-bold text-stone-700 pb-1 border-b border-orange-100">
              <span className="flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-orange-500" />
                <span>{t.cart_title} ({cart.reduce((a, b) => a + b.quantity, 0)})</span>
              </span>
              <button
                onClick={clearCart}
                className="text-rose-500 hover:text-rose-600 flex items-center gap-0.5 text-[11px] font-semibold"
              >
                <Trash2 className="w-3 h-3" />
                <span>{t.clear_cart}</span>
              </button>
            </div>

            {cart.map((c) => (
              <div key={c.menuItem.id} className="text-xs bg-white p-2.5 rounded-xl border border-orange-100 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-800">{c.menuItem.name[language]}</span>
                  <span className="font-mono text-orange-600 font-extrabold">
                    Rp {(c.menuItem.price * c.quantity).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-stone-500 gap-2">
                  <input
                    type="text"
                    value={c.notes}
                    onChange={(e) => updateNotes(c.menuItem.id, e.target.value)}
                    placeholder={t.notes_placeholder}
                    className="bg-stone-50 border border-stone-200 rounded-lg px-2 py-0.5 text-[10px] text-stone-700 focus:outline-none focus:border-orange-400 flex-1 placeholder:text-stone-400"
                  />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(c.menuItem.id, -1)}
                      className="p-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono w-4 text-center font-bold text-stone-800">{c.quantity}</span>
                    <button
                      onClick={() => updateQuantity(c.menuItem.id, 1)}
                      className="p-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-2 text-xs text-stone-400 font-medium">
            {t.cart_empty}
          </div>
        )}

        {/* Subtotal, Tax, Total */}
        <div className="space-y-1 pt-1 border-t border-stone-100 text-xs text-stone-500">
          <div className="flex justify-between">
            <span>{t.subtotal}:</span>
            <span className="font-mono text-stone-700 font-medium">Rp {subtotal.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between">
            <span>{t.tax}:</span>
            <span className="font-mono text-stone-700 font-medium">Rp {tax.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between text-stone-900 font-bold text-sm pt-1 border-t border-orange-100">
            <span>{t.total}:</span>
            <span className="font-mono text-orange-600 text-base font-extrabold">
              Rp {grandTotal.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Idempotency Key Live Display */}
        <div className="flex items-center justify-between text-[10px] text-stone-500 font-mono bg-orange-50/70 px-2.5 py-1.5 rounded-xl border border-orange-200/80">
          <span className="flex items-center gap-1 text-stone-600 font-sans font-medium">
            <Key className="w-3 h-3 text-orange-500" />
            <span>{t.idempotency_hint}:</span>
          </span>
          <span className="text-orange-700 font-bold truncate max-w-[170px]" title={currentIdempotencyKey}>
            {currentIdempotencyKey}
          </span>
        </div>

        {/* Checkout Button with Warm Pulse Animation */}
        <button
          onClick={handleCheckout}
          disabled={cart.length === 0 || isCheckoutLocked}
          className={`w-full py-3.5 px-4 rounded-2xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md ${
            optimisticFlash ? 'optimistic-pulse bg-emerald-500 text-white scale-102 ring-2 ring-emerald-300' : ''
          } ${
            cart.length === 0
              ? 'bg-stone-100 text-stone-400 cursor-not-allowed border border-stone-200'
              : isCheckoutLocked
              ? 'bg-orange-400 text-white cursor-wait'
              : 'bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-orange-500/25 active:scale-[0.98]'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>
            {isCheckoutLocked ? t.btn_checkout_processing : t.btn_checkout}
          </span>
        </button>
      </div>
    </div>
  );
};
