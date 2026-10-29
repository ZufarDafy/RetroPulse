import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Language } from '../types';
import type { ViewMode } from './Navbar';
import {
  Compass,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  Lightbulb,
  CheckCircle2,
} from 'lucide-react';
import { playTapSound, playSuccessChime } from '../utils/sound';

export interface TourStep {
  targetSelector: string;
  viewMode?: ViewMode;
  title: Record<Language, string>;
  description: Record<Language, string>;
  tip: Record<Language, string>;
}

export const TOUR_STEPS: TourStep[] = [
  {
    targetSelector: '[data-tour="navbar-views"]',
    viewMode: 'client',
    title: {
      en: '1. View Mode Switcher',
      id: '1. Pengalih Tampilan Mode',
      zh: '1. 视图模式切换器',
    },
    description: {
      en: 'Switch between "Operations (POS & KDS)" for everyday restaurant flow, and "Field Sandbox & Logs" to simulate real-world hardware & network disasters.',
      id: 'Gunakan tombol ini untuk beralih antara "Operasional (POS & KDS)" kasir/dapur, dan "Sandbox & Log Insinyur" untuk menguji simulasi gangguan.',
      zh: '在此切换"前台运营 (POS & KDS)"与"混沌沙盒与排查日志"，随心体验现场故障注入。',
    },
    tip: {
      en: 'Try switching to Sandbox anytime to see how the system handles chaos!',
      id: 'Anda dapat beralih ke Sandbox kapan saja untuk menguji ketahanan sistem!',
      zh: '可随时切换至沙盒模式观察系统如何从容应对故障！',
    },
  },
  {
    targetSelector: '[data-tour="navbar-table-lang"]',
    viewMode: 'client',
    title: {
      en: '2. Table Selector & Multi-Language',
      id: '2. Pilih Meja & Pengganti Bahasa',
      zh: '2. 桌号选择与多语言切换',
    },
    description: {
      en: 'Assign orders to specific tables (T-01, VIP, Takeaway) and dynamically toggle the UI between English, Bahasa Indonesia, and Chinese.',
      id: 'Pilih nomor meja pesanan (Meja T-01 hingga VIP/Takeaway) dan ubah bahasa UI secara instan (EN, ID, 中文).',
      zh: '为订单指定就餐桌号（堂食或外带），并即时在英文、印尼语及中文间无缝切换。',
    },
    tip: {
      en: 'All menu items and status badges translate dynamically in real time.',
      id: 'Seluruh katalog menu dan status akan otomatis diterjemahkan seketika.',
      zh: '所有菜品与状态标签均支持秒级动态本地化翻译。',
    },
  },
  {
    targetSelector: '[data-tour="pos-menu-grid"]',
    viewMode: 'client',
    title: {
      en: '3. Food Catalog & Optimistic UI (<50ms)',
      id: '3. Katalog Menu & Optimistic UI (<50ms)',
      zh: '3. 餐品点单与乐观更新 (<50ms)',
    },
    description: {
      en: 'Browse delicious dishes. Tapping "+ Add" instantly updates your cart in less than 50ms before the backend responds, eliminating cashier loading spinners.',
      id: 'Klik tombol "+ Tambah" pada menu makanan. Antarmuka merespons seketika dalam <50ms secara optimistik tanpa membuat kasir menunggu loading.',
      zh: '点击 "+ 添加" 将美味加入购物车。前端在 50ms 内瞬间完成乐观响应，收银端绝无白屏转圈。',
    },
    tip: {
      en: 'Click any food item right now to try adding it to your cart!',
      id: 'Coba klik salah satu menu makanan sekarang untuk melihat responsnya!',
      zh: '立即点击任意菜品，亲身体验极速加购效果！',
    },
  },
  {
    targetSelector: '[data-tour="pos-checkout-section"]',
    viewMode: 'client',
    title: {
      en: '4. Cart, Idempotency Key & Double-Tap Blocker',
      id: '4. Keranjang, Idempotency Key & Anti Double-Tap',
      zh: '4. 购物车、幂等密钥与防重击结账',
    },
    description: {
      en: 'Every order generates an RFC4122 UUID v4 Idempotency Key. If a cashier or customer rapidly spam-clicks Checkout during network lag, the debounce lock absorbs duplicates so no one is double-charged!',
      id: 'Setiap pesanan memiliki Idempotency Key unik. Jika tombol Checkout ditekan berkali-kali secara cepat saat jaringan ngelag, klik ganda langsung ditahan tanpa membuat transaksi dobel.',
      zh: '每笔点餐均生成唯一 RFC4122 UUID 幂等键。即使在卡顿中断疯狂连击结账，防抖锁也会拦截重复提交，杜绝二次扣费！',
    },
    tip: {
      en: 'Try double-clicking Checkout rapidly to see the warning banner appear!',
      id: 'Coba tekan tombol Checkout berkali-kali dengan cepat untuk melihat proteksinya!',
      zh: '快速连续点击结账按钮，即可看到防重告警横幅！',
    },
  },
  {
    targetSelector: '[data-tour="kds-hardware-bar"]',
    viewMode: 'client',
    title: {
      en: '5. Hardware Status & Fault Isolation',
      id: '5. Status Hardware & Isolasi Gangguan',
      zh: '5. 外设硬件状态与故障隔离',
    },
    description: {
      en: 'Live health status of Bluetooth Thermal Printer and QRIS Gateway. If the printer disconnects, orders still succeed in database and KDS with an auto-queued reprint badge.',
      id: 'Monitor status printer thermal bluetooth dan gateway QRIS. Jika printer mati, pesanan tetap sukses masuk dapur dan diberi badge "Struk Antri Cetak Ulang".',
      zh: '实时监控蓝牙小票机与支付网关。小票机掉线时点单照样成功，小票自动流转至待重打队列。',
    },
    tip: {
      en: 'Hardware failures never crash the cashier checkout flow.',
      id: 'Kegagalan hardware tidak akan pernah membuat aplikasi kasir macet atau error 500.',
      zh: '外设故障完全物理隔离，绝不阻断前台正常结账。',
    },
  },
  {
    targetSelector: '[data-tour="kds-column"]',
    viewMode: 'client',
    title: {
      en: '6. Kitchen Display System (KDS)',
      id: '6. Kitchen Display System (KDS)',
      zh: '6. 厨房显示系统 (KDS)',
    },
    description: {
      en: 'Kitchen tickets stream live into this dedicated scrollable column. Chefs can track cooking time, transition status (Pending -> Cooking -> Served), and reprint receipts.',
      id: 'Kolom KDS khusus dapur dengan scroll independen. Koki dapat melihat pesanan masuk, memantau timer, dan mengubah status (Menunggu -> Dimasak -> Disajikan).',
      zh: '后厨订单独立滚动流转。厨师可掌控等待计时、流转制作状态，并一键补打小票。',
    },
    tip: {
      en: 'Notice that only the internal KDS card scrolls, keeping the window neat!',
      id: 'Perhatikan bahwa hanya bagian KDS yang terscroll secara independen!',
      zh: '请注意仅后厨卡片内部可独立滚动，整页高度始终锁定不拉伸！',
    },
  },
  {
    targetSelector: '[data-tour="chaos-sandbox-container"]',
    viewMode: 'sandbox',
    title: {
      en: '7. Field Chaos Simulator & Root-Cause Logs',
      id: '7. Simulator Gangguan Lapangan & Log Root-Cause',
      zh: '7. 现场混沌故障注入与根因日志',
    },
    description: {
      en: 'Simulate restaurant WiFi drops (Offline Queue), 2500ms network lag, printer disconnections, and database 500 locks. Inspect real-time logs with automated root-cause diagnosis!',
      id: 'Uji 4 sakelar gangguan: WiFi drop (Antrian Offline), latensi 2500ms, printer mati, dan DB 500 lock. Amati inspektur log dengan diagnosa akar masalah otomatis!',
      zh: '随手注入 WiFi 断网（离线队列）、2500ms 延迟、打印机断开与 DB 死锁。底部检视器智能输出根因分析！',
    },
    tip: {
      en: 'Turn on WiFi Drop, make an order in POS, then turn WiFi back on to see auto-sync!',
      id: 'Nyalakan WiFi Drop, buat pesanan di POS, lalu matikan lagi untuk melihat auto-sync!',
      zh: '开启断网后在 POS 下单，再关闭断网即可亲眼目睹本地排队批量自动重连同步！',
    },
  },
];

interface InteractiveTourProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  currentViewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
}

export const InteractiveTour: React.FC<InteractiveTourProps> = ({
  isOpen,
  onClose,
  language,
  currentViewMode,
  onSetViewMode,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const currentStep = TOUR_STEPS[stepIndex];

  // Measure and position highlight box
  const updateTargetPosition = useCallback(() => {
    if (!isOpen || !currentStep) return;

    const el = document.querySelector(currentStep.targetSelector);
    if (el) {
      // Smoothly scroll into view if outside
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [isOpen, currentStep]);

  // Handle viewMode switching & step change
  useEffect(() => {
    if (!isOpen) return;

    if (currentStep?.viewMode && currentStep.viewMode !== currentViewMode) {
      onSetViewMode(currentStep.viewMode);
    }

    // Wait for DOM layout update after viewMode transition
    const timer = setTimeout(() => {
      updateTargetPosition();
    }, 180);

    return () => clearTimeout(timer);
  }, [isOpen, stepIndex, currentStep, currentViewMode, onSetViewMode, updateTargetPosition]);

  // Listen to window resize and scroll
  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener('resize', updateTargetPosition);
    window.addEventListener('scroll', updateTargetPosition, true);

    const el = currentStep ? document.querySelector(currentStep.targetSelector) : null;
    if (el && 'ResizeObserver' in window) {
      resizeObserverRef.current = new ResizeObserver(() => updateTargetPosition());
      resizeObserverRef.current.observe(el);
    }

    return () => {
      window.removeEventListener('resize', updateTargetPosition);
      window.removeEventListener('scroll', updateTargetPosition, true);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [isOpen, currentStep, updateTargetPosition]);

  if (!isOpen || !currentStep) return null;

  const handleNext = () => {
    playTapSound();
    if (stepIndex < TOUR_STEPS.length - 1) {
      setStepIndex((prev) => prev + 1);
    } else {
      playSuccessChime();
      onClose();
    }
  };

  const handlePrev = () => {
    playTapSound();
    if (stepIndex > 0) {
      setStepIndex((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    playTapSound();
    onClose();
  };

  // Compute smart popover position relative to target element
  const getPopoverStyle = () => {
    if (!targetRect) {
      // Fallback center modal if element not in DOM
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const popoverWidth = Math.min(420, windowWidth - 32);
    const popoverHeight = 310;

    let top = targetRect.bottom + 16;
    let left = targetRect.left + targetRect.width / 2 - popoverWidth / 2;

    // If bottom overflow, place above target
    if (top + popoverHeight > windowHeight - 20) {
      top = Math.max(16, targetRect.top - popoverHeight - 16);
    }

    // Horizontal clamp
    if (left < 16) left = 16;
    if (left + popoverWidth > windowWidth - 16) {
      left = windowWidth - popoverWidth - 16;
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
      width: `${popoverWidth}px`,
    };
  };

  const isLastStep = stepIndex === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-auto select-none overflow-hidden animate-fade-in">
      {/* 1. Spotlight Cutout Overlay Box */}
      {targetRect && (
        <div
          className="fixed pointer-events-none transition-all duration-300 ease-out rounded-2xl z-[101]"
          style={{
            top: `${Math.max(0, targetRect.top - 6)}px`,
            left: `${Math.max(0, targetRect.left - 6)}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.72)',
            border: '3px solid #f97316',
          }}
        >
          {/* Animated glow ripple around highlighted element */}
          <div className="absolute -inset-2 rounded-2xl border-2 border-orange-400 animate-pulse opacity-75 pointer-events-none" />
          <div className="absolute -top-3.5 -right-3.5 w-7 h-7 rounded-full bg-orange-500 text-white font-mono font-extrabold text-xs flex items-center justify-center shadow-md shadow-orange-500/50 border-2 border-white animate-bounce">
            {stepIndex + 1}
          </div>
        </div>
      )}

      {/* Fallback dark backdrop if element isn't located */}
      {!targetRect && (
        <div className="fixed inset-0 bg-stone-900/75 backdrop-blur-xs z-[101]" />
      )}

      {/* 2. Floating Step Tour Card */}
      <div
        className="fixed z-[105] bg-white rounded-3xl shadow-2xl border border-orange-200/90 flex flex-col overflow-hidden transition-all duration-300 animate-scale-in"
        style={getPopoverStyle()}
      >
        {/* Card Header */}
        <div className="flex-shrink-0 px-5 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Compass className="w-4 h-4 text-white animate-spin-slow" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-extrabold tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                Interactive Baby Steps
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold bg-black/20 px-2.5 py-0.5 rounded-lg">
              {stepIndex + 1} / {TOUR_STEPS.length}
            </span>
            <button
              onClick={handleSkip}
              className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
              title={language === 'id' ? 'Keluar dari Tour' : language === 'zh' ? '退出引导' : 'Exit Tour'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-orange-100">
          <div
            className="h-full bg-orange-500 transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        {/* Card Body */}
        <div className="p-5 space-y-3.5 bg-[#fffaf5]/60 flex-1 min-h-0 overflow-y-auto">
          {/* Title */}
          <h3 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <span>{currentStep.title[language]}</span>
          </h3>

          {/* Description */}
          <p className="text-xs text-stone-600 leading-relaxed font-medium">
            {currentStep.description[language]}
          </p>

          {/* Interactive Pro Tip Box */}
          <div className="bg-orange-50/80 rounded-2xl p-3 border border-orange-200/80 flex items-start gap-2.5 text-xs text-orange-900 shadow-2xs">
            <Lightbulb className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold block text-[11px] text-orange-800">
                {language === 'id' ? 'Petunjuk Aksi / Pro-Tip:' : language === 'zh' ? '实操提示：' : 'Action Tip:'}
              </span>
              <span className="text-[11px] text-orange-700 font-medium">
                {currentStep.tip[language]}
              </span>
            </div>
          </div>
        </div>

        {/* Card Footer Navigation */}
        <div className="flex-shrink-0 px-5 py-3 bg-white border-t border-orange-100 flex items-center justify-between gap-2">
          <button
            onClick={handleSkip}
            className="text-xs font-semibold text-stone-400 hover:text-stone-700 transition-colors"
          >
            {language === 'id' ? 'Lewati Tour' : language === 'zh' ? '跳过引导' : 'Skip Tour'}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={stepIndex === 0}
              className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>{language === 'id' ? 'Kembali' : language === 'zh' ? '上一步' : 'Back'}</span>
            </button>

            <button
              onClick={handleNext}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold shadow-sm shadow-orange-500/25 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <span>
                {isLastStep
                  ? language === 'id'
                    ? 'Selesai Tour 🎉'
                    : language === 'zh'
                    ? '完成体验 🎉'
                    : 'Finish Tour 🎉'
                  : language === 'id'
                  ? 'Lanjut'
                  : language === 'zh'
                  ? '下一步'
                  : 'Next'}
              </span>
              {!isLastStep ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

