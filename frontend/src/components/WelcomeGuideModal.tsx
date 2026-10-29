import React, { useState, useEffect } from 'react';
import type { Language } from '../types';
import type { ViewMode } from './Navbar';
import { UI_TRANSLATIONS } from '../utils/translations';
import { playTapSound, playSuccessChime } from '../utils/sound';
import {
  BookOpen,
  Sparkles,
  ShieldCheck,
  WifiOff,
  Printer,
  ChevronRight,
  ChevronLeft,
  X,
  Play,
  Layers,
  UtensilsCrossed,
  Terminal,
  ArrowRight,
  Info,
} from 'lucide-react';

interface WelcomeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onNavigateScenario: (mode: ViewMode) => void;
}

export const WelcomeGuideModal: React.FC<WelcomeGuideModalProps> = ({
  isOpen,
  onClose,
  language,
  onNavigateScenario,
}) => {
  const t = UI_TRANSLATIONS[language];
  const [activeTab, setActiveTab] = useState<'about' | 'steps'>('about');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem('restopulse_onboarding_dismissed') === 'true';
    setDontShowAgain(isDismissed);
  }, []);

  const handleClose = () => {
    playTapSound();
    if (dontShowAgain) {
      localStorage.setItem('restopulse_onboarding_dismissed', 'true');
    } else {
      localStorage.removeItem('restopulse_onboarding_dismissed');
    }
    onClose();
  };

  const handleToggleDontShowAgain = () => {
    playTapSound();
    const nextVal = !dontShowAgain;
    setDontShowAgain(nextVal);
    if (nextVal) {
      localStorage.setItem('restopulse_onboarding_dismissed', 'true');
    } else {
      localStorage.removeItem('restopulse_onboarding_dismissed');
    }
  };

  const handleTryScenario = (targetMode: ViewMode) => {
    playSuccessChime();
    if (dontShowAgain) {
      localStorage.setItem('restopulse_onboarding_dismissed', 'true');
    }
    onNavigateScenario(targetMode);
    onClose();
  };

  if (!isOpen) return null;

  // 5 Baby Steps Content
  const stepsData = [
    {
      step: 1,
      title: language === 'id' ? 'Simulasi Pesanan Normal (Optimistic UI <50ms)' : language === 'zh' ? '正常点餐模拟 (乐观更新 <50ms)' : 'Normal Order Simulation (Optimistic UI <50ms)',
      icon: <UtensilsCrossed className="w-5 h-5 text-orange-600" />,
      scenarioBadge: language === 'id' ? 'Langkah 1: Kasir & Dapur Normal' : language === 'zh' ? '第 1 步：正常前台与厨房' : 'Step 1: Normal POS & Kitchen',
      targetMode: 'client' as ViewMode,
      description:
        language === 'id'
          ? 'Memahami alur pesanan standar dari kasir pelanggan hingga tiket masuk ke Kitchen Display System (KDS).'
          : language === 'zh'
          ? '了解从顾客/员工前台点餐到小票流入厨房显示系统 (KDS) 的标准流程。'
          : 'Understand the standard order flow from customer/staff POS to tickets landing on the Kitchen Display System (KDS).',
      instructions: [
        language === 'id' ? 'Buka kolom kiri (POS & QR Kasir), klik tombol "+ Tambah" pada menu (misal: Nasi Goreng Spesial).' : language === 'zh' ? '在左侧 POS 点餐栏点击 "+ 添加" 将菜品加入购物车。' : 'In the left POS column, click "+ Add" on any menu item.',
        language === 'id' ? 'Perhatikan keranjang: Anda dapat menambah kuantitas dan catatan khusus (misal: "tanpa cabai").' : language === 'zh' ? '注意购物车：可以调整数量并添加备注文案。' : 'Review your cart: adjust quantities and custom kitchen notes.',
        language === 'id' ? 'Klik tombol "Checkout & Cetak Struk (QRIS)".' : language === 'zh' ? '点击 "立即结账并出票 (QRIS)" 按钮。' : 'Click "Checkout & Print Receipt (QRIS)".',
        language === 'id' ? 'Lihat respons instan (<50ms): Struk pembayaran muncul seketika, dan tiket langsung mengalir ke kolom Kitchen Display (KDS).' : language === 'zh' ? '体验即时响应 (<50ms)：小票弹出，订单直接同步到右侧厨房 KDS。' : 'Experience instant feedback (<50ms): receipt pops up, and ticket lands on the KDS.',
      ],
      behindTheScenes:
        language === 'id'
          ? 'Sistem menghasilkan RFC4122 Idempotency Key secara otomatis dan mengupdate UI secara optimistik sebelum backend selesai memproses, sehingga kasir tidak menunggu layar loading.'
          : language === 'zh'
          ? '前端自动生成 RFC4122 幂等键并在后端返回前完成乐观渲染，彻底杜绝收银员面对白屏加载的等待烦恼。'
          : 'The client generates an RFC4122 Idempotency Key and renders optimistically before backend response, eliminating cashier loading spinners.',
      actionText: language === 'id' ? 'Praktekkan di POS & KDS' : language === 'zh' ? '前往 POS 与 KDS 体验' : 'Try on POS & KDS',
    },
    {
      step: 2,
      title: language === 'id' ? 'Uji Ketahanan Double-Tap (Anti Dobel Pesan)' : language === 'zh' ? '快速双击防重保护 (幂等性测试)' : 'Rapid Double-Tap Protection (Idempotency Test)',
      icon: <ShieldCheck className="w-5 h-5 text-emerald-600" />,
      scenarioBadge: language === 'id' ? 'Langkah 2: Proteksi UX & Keuangan' : language === 'zh' ? '第 2 步：防重结账保护' : 'Step 2: UX Friction & Double-Charge Guard',
      targetMode: 'client' as ViewMode,
      description:
        language === 'id'
          ? 'Mensimulasikan kasir atau pelanggan yang panik menekan tombol checkout berkali-kali secara cepat saat sinyal terasa lambat.'
          : language === 'zh'
          ? '模拟收银员或顾客因网络卡顿而疯狂多次连击结账按钮的真实场景。'
          : 'Simulates panicked cashiers or guests tapping the Checkout button multiple times during network hiccups.',
      instructions: [
        language === 'id' ? 'Tambahkan makanan ke keranjang di kolom POS.' : language === 'zh' ? '在 POS 栏添加任意餐品到购物车。' : 'Add any menu item to your cart in POS.',
        language === 'id' ? 'Tekan tombol "Checkout & Cetak Struk" sebanyak 3-5 kali secara sangat cepat (rapid tap).' : language === 'zh' ? '以极快的手速连续点击 3-5 次结账按钮。' : 'Aggressively tap the "Checkout" button 3 to 5 times in rapid succession.',
        language === 'id' ? 'Perhatikan banner peringatan merah: "Perhatian: Klik ganda terdeteksi! Transaksi duplikat telah diblokir".' : language === 'zh' ? '观察顶部弹出的红色防重提醒横幅。' : 'Observe the red warning banner: "Rapid double-tap detected! Duplicate order blocked".',
        language === 'id' ? 'Cek KDS: Hanya 1 pesanan yang masuk. Tidak ada pemotongan saldo ganda atau tiket dobel di dapur!' : language === 'zh' ? '检查右侧 KDS：只产生 1 张小票，杜绝双重扣费与后厨重单！' : 'Verify KDS: exactly 1 order is created. Zero double-charges, zero duplicate kitchen tickets!',
      ],
      behindTheScenes:
        language === 'id'
          ? 'Debounce lock di sisi klien menahan klik beruntun, dan Go backend memverifikasi X-Idempotency-Key. Jika kunci sama dikirim ulang, server mengembalikan replay data aman tanpa membuat record ganda.'
          : language === 'zh'
          ? '前端防抖锁锁定按钮，Go 后端校验 X-Idempotency-Key，同一意图密钥重放直接返回已存订单，确保完全幂等。'
          : 'Client debounce lock intercepts rapid taps, while Go backend enforces X-Idempotency-Key deduplication and safe replays.',
      actionText: language === 'id' ? 'Uji Coba Double-Tap di POS' : language === 'zh' ? '前去测试防双击' : 'Test Double-Tap in POS',
    },
    {
      step: 3,
      title: language === 'id' ? 'Simulasi WiFi Restoran Mati (Offline Sync Queue)' : language === 'zh' ? '餐厅 WiFi 断网模拟 (离线队列自动同步)' : 'Simulate Restaurant WiFi Drop (Offline Sync Queue)',
      icon: <WifiOff className="w-5 h-5 text-rose-600" />,
      scenarioBadge: language === 'id' ? 'Langkah 3: Ketahanan Offline' : language === 'zh' ? '第 3 步：断网离线韧性' : 'Step 3: Offline Resilience',
      targetMode: 'sandbox' as ViewMode,
      description:
        language === 'id'
          ? 'Bagaimana kasir tetap bisa melayani tamu saat router WiFi restoran terputus total tanpa kehilangan satupun transaksi.'
          : language === 'zh'
          ? '测试在餐厅路由器断网、断线情况下，前台如何零中断继续点餐并自动排队。'
          : 'Experience how restaurant staff can continue taking orders even when the local WiFi router completely drops out.',
      instructions: [
        language === 'id' ? 'Di Sandbox & Log Insinyur, nyalakan sakelar "Simulasi WiFi Restoran Drop (Offline Mode)".' : language === 'zh' ? '在沙盒页面打开 "模拟餐厅 WiFi 断网 (离线模式)" 开关。' : 'In the Sandbox view, toggle ON "Simulate Restaurant WiFi Drop (Offline Mode)".',
        language === 'id' ? 'Kembali ke POS (atau gunakan tampilan 3 Kolom), lalu lakukan pemesanan.' : language === 'zh' ? '返回 POS 正常下单。' : 'Go back to POS and place an order.',
        language === 'id' ? 'Pesanan berhasil dibuat dengan badge oranye "Antri Offline", tersimpan aman di LocalStorage browser.' : language === 'zh' ? '订单顺利生成并带有 "离线排队" 标记，已安全加密存入本地存储。' : 'The order succeeds with an orange "Queued Offline" badge, safely saved in browser LocalStorage.',
        language === 'id' ? 'Matikan kembali sakelar WiFi di Sandbox: Sistem secara otomatis mendeteksi koneksi pulih dan melakukan batch sync ke Go backend!' : language === 'zh' ? '关闭断网开关：系统毫秒级检测到网络恢复并自动将排队订单批量同步到 Go 后端！' : 'Turn OFF the WiFi toggle: the app auto-detects reconnection and flushes queued orders to Go backend via batch sync!',
      ],
      behindTheScenes:
        language === 'id'
          ? 'Ketika offline terdeteksi, request dialihkan ke antrian LocalStorage. Saat WiFi kembali aktif, event WIFI_CONNECTION_RESTORED memicu endpoint /api/v1/orders/batch-sync secara otomatis.'
          : language === 'zh'
          ? '断网时请求入队本地 Storage，恢复后通过 /api/v1/orders/batch-sync 批量入库，绝不丢单。'
          : 'Orders queue in LocalStorage while offline. On reconnection, /api/v1/orders/batch-sync automatically reconciles all items with deduplication.',
      actionText: language === 'id' ? 'Buka Sandbox WiFi' : language === 'zh' ? '打开 WiFi 混沌沙盒' : 'Open WiFi Chaos Sandbox',
    },
    {
      step: 4,
      title: language === 'id' ? 'Simulasi Printer Thermal Mati (Hardware Isolation)' : language === 'zh' ? '蓝牙小票机掉线 (硬件故障隔离)' : 'Bluetooth Printer Disconnected (Hardware Fault Isolation)',
      icon: <Printer className="w-5 h-5 text-amber-600" />,
      scenarioBadge: language === 'id' ? 'Langkah 4: Isolasi Hardware' : language === 'zh' ? '第 4 步：硬件故障隔离' : 'Step 4: Hardware Fault Isolation',
      targetMode: 'sandbox' as ViewMode,
      description:
        language === 'id'
          ? 'Thermal printer bluetooth kehabisan kertas atau mati baterai tidak boleh menyebabkan kasir crash atau pesanan gagal.'
          : language === 'zh'
          ? '后厨或前台蓝牙热敏打印机突然缺纸或关机时，保证点餐交易绝不崩溃。'
          : 'Bluetooth printer runs out of paper or disconnects — preventing cashier crashes or failed transactions.',
      instructions: [
        language === 'id' ? 'Buka tampilan "Sandbox & Log Insinyur", ubah sakelar Printer Bluetooth menjadi "Terputus".' : language === 'zh' ? '在沙盒中将热敏打印机状态切换为 "未连接"。' : 'In Sandbox view, switch Bluetooth Printer status to "Disconnected".',
        language === 'id' ? 'Lakukan checkout pesanan baru dari POS.' : language === 'zh' ? '从 POS 提交一笔新订单。' : 'Place a new order from POS.',
        language === 'id' ? 'Pesanan tetap sukses masuk ke database backend dan tiket langsung muncul di KDS!' : language === 'zh' ? '订单仍然成功入库，KDS 实时收到烹饪任务！' : 'The transaction succeeds, lands in backend DB, and shows up on KDS!',
        language === 'id' ? 'Tiket dapur menampilkan badge kuning "Struk Antri Cetak Ulang", dan kasir dapat menekan tombol "Cetak Ulang" kapan saja saat printer online kembali.' : language === 'zh' ? '小票自动打上 "待重打" 黄色告警标，打印机连回后可一键补打。' : 'The ticket shows a "Receipt Queued for Reprint" badge with a one-click Reprint action ready when printer reconnects.',
      ],
      behindTheScenes:
        language === 'id'
          ? 'Arsitektur mengisolasi kegagalan peripheral dari transaksi inti. Error printer ditandai sebagai print_status="QUEUED_FOR_REPRINT" di database tanpa melempar HTTP 500 ke kasir.'
          : language === 'zh'
          ? '外设故障被完全隔离，打印异常仅标记为 QUEUED_FOR_REPRINT，不向收银端抛出 HTTP 500 错误。'
          : 'Peripheral failures are isolated from the core financial path. Printer fault is tagged as QUEUED_FOR_REPRINT without throwing HTTP 500 to the POS.',
      actionText: language === 'id' ? 'Buka Sandbox Printer' : language === 'zh' ? '前往打印机沙盒' : 'Open Printer Sandbox',
    },
    {
      step: 5,
      title: language === 'id' ? 'Inspeksi Root-Cause Log Diagnostik' : language === 'zh' ? '排查诊断日志与自动根因分析' : 'Inspect Diagnostic Logs & Root Cause Diagnosis',
      icon: <Terminal className="w-5 h-5 text-indigo-600" />,
      scenarioBadge: language === 'id' ? 'Langkah 5: Diagnostik Lapangan' : language === 'zh' ? '第 5 步：现场工程诊断' : 'Step 5: Field Engineering Diagnostics',
      targetMode: 'sandbox' as ViewMode,
      description:
        language === 'id'
          ? 'Melihat bagaimana insinyur lapangan atau tim support dapat membedah setiap anomali dengan audit log real-time.'
          : language === 'zh'
          ? '了解现场运维与技术工程师如何通过实时审计日志快速定位系统故障根因。'
          : 'See how field engineers diagnose restaurant anomalies in real time with structured root cause categorization.',
      instructions: [
        language === 'id' ? 'Buka tampilan "Sandbox & Log Insinyur", scroll ke panel "Pemeriksa Log Diagnostik" di bagian bawah.' : language === 'zh' ? '在沙盒页面滑动到底部的 "实时结构化诊断日志检视器"。' : 'In Sandbox view, scroll to the bottom "Root-Cause Diagnostic Log Inspector".',
        language === 'id' ? 'Gunakan filter kategori: [NETWORK], [HARDWARE], [UX_BEHAVIOR], atau [BACKEND].' : language === 'zh' ? '使用分类标签筛选：[NETWORK], [HARDWARE], [UX_BEHAVIOR], [BACKEND]。' : 'Filter by category badges: [NETWORK], [HARDWARE], [UX_BEHAVIOR], [BACKEND].',
        language === 'id' ? 'Perhatikan detail log: Timestamp presisi, durasi latensi payload (ms), dan automated root-cause diagnosis.' : language === 'zh' ? '查看每条日志的纳秒级时间戳、耗时延迟以及智能根因排查建议。' : 'Inspect each log entry for exact timestamp, payload latency (ms), and automated root-cause diagnosis.',
        language === 'id' ? 'Anda dapat menekan "Ekspor JSON" untuk mengunduh log audit sesi ke komputer Anda.' : language === 'zh' ? '可以随时点击 "导出 JSON" 下载完整审计日志。' : 'Click "Export JSON" to download the full session audit log.',
      ],
      behindTheScenes:
        language === 'id'
          ? 'Setiap mutasi state dan event chaos dicatat ke tabel diagnostic_logs di SQLite dan di-stream ke frontend secara otomatis untuk visibilitas 100% tanpa blind spot.'
          : language === 'zh'
          ? '系统各模块所有异常与操作均沉淀至 SQLite 的 diagnostic_logs 表并实时呈现，现场排障零盲区。'
          : 'All state mutations and chaos triggers are captured in SQLite diagnostic_logs and streamed live to eliminate operational blind spots.',
      actionText: language === 'id' ? 'Inspeksi Log di Sandbox' : language === 'zh' ? '前往检视系统日志' : 'Inspect Logs in Sandbox',
    },
  ];

  const currentStepData = stepsData[currentStep - 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-orange-100/80 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header Modal */}
        <div className="flex-shrink-0 px-6 py-4 bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold tracking-tight">RestoPulse</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-white/25 text-white text-[10px] font-bold uppercase tracking-wider">
                  {t.guide_badge}
                </span>
              </div>
              <p className="text-xs text-orange-100 font-medium">
                {language === 'id'
                  ? 'Offline-Resilient POS, KDS & Field Diagnostic Sandbox'
                  : language === 'zh'
                  ? '离线坚韧餐厅收银、厨房显示系统与现场故障沙盒'
                  : 'Offline-Resilient POS, KDS & Field Diagnostic Sandbox'}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex-shrink-0 px-6 pt-3 pb-2 border-b border-orange-100 bg-[#fffdfa] flex items-center gap-2">
          <button
            onClick={() => {
              playTapSound();
              setActiveTab('about');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'about'
                ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20'
                : 'text-stone-600 hover:text-stone-900 hover:bg-orange-50'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>{t.tab_about}</span>
          </button>

          <button
            onClick={() => {
              playTapSound();
              setActiveTab('steps');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'steps'
                ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20'
                : 'text-stone-600 hover:text-stone-900 hover:bg-orange-50'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{t.tab_steps}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'steps' ? 'bg-white/25 text-white' : 'bg-orange-100 text-orange-700'
              }`}
            >
              5 Steps
            </span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 bg-[#fffaf5]/50 space-y-5">
          {/* TAB 1: TENTANG & KONTEKS SISTEM */}
          {activeTab === 'about' && (
            <div className="space-y-6">
              {/* Introduction Banner */}
              <div className="bg-gradient-to-br from-orange-50 to-amber-50/60 rounded-2xl p-4 sm:p-5 border border-orange-200/80 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold flex-shrink-0 shadow-sm shadow-orange-500/25">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-stone-900">
                      {language === 'id'
                        ? 'Mengapa RestoPulse Dibuat?'
                        : language === 'zh'
                        ? '为什么需要 RestoPulse？'
                        : 'Why Was RestoPulse Built?'}
                    </h3>
                    <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                      {language === 'id'
                        ? 'Restoran adalah lingkungan operasional yang keras: router WiFi sering drop mendadak, kasir panik menekan tombol bayar berulang-ulang saat internet ngelag, printer bluetooth kehabisan kertas, dan server database lock saat jam sibuk. RestoPulse adalah platform sandbox interaktif untuk mendemonstrasikan bagaimana sistem POS & KDS modern tetap tangguh tanpa pernah kehilangan pesanan, tanpa mendobel saldo pelanggan, dan tanpa membuat antrian kasir macet.'
                        : language === 'zh'
                        ? '餐饮门店现场环境严苛：WiFi 频繁瞬断、收银员在卡顿时疯狂连击、蓝牙小票机突然缺纸、高峰期数据库死锁。RestoPulse 是一个互动式沙盒平台，向您展示现代 POS 和 KDS 如何做到断网零丢单、杜绝重复扣款、外设故障零阻塞。'
                        : 'Restaurants face harsh operational friction: sudden WiFi drops, panicked cashiers rapid-tapping during lag, Bluetooth printers running out of paper, and peak-hour DB locks. RestoPulse is an interactive sandbox proving how modern POS & KDS systems remain resilient without losing orders, double-charging guests, or freezing checkout queues.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 3 Core System Pillars */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-400 mb-3">
                  {language === 'id'
                    ? '3 Pilar Solusi Teknis RestoPulse'
                    : language === 'zh'
                    ? 'RestoPulse 三大核心技术支柱'
                    : '3 Core Architectural Pillars'}
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {/* Pilar 1 */}
                  <div className="bg-white rounded-2xl p-4 border border-orange-100 shadow-xs hover:border-orange-300 transition-all flex flex-col justify-between">
                    <div>
                      <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold mb-2.5">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <h5 className="text-xs font-bold text-stone-900">
                        {language === 'id'
                          ? '1. Idempotency & Optimistic UI'
                          : language === 'zh'
                          ? '1. 幂等控制与乐观更新'
                          : '1. Idempotency & Optimistic UI'}
                      </h5>
                      <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                        {language === 'id'
                          ? 'Setiap transaksi memiliki RFC4122 UUID v4 unik. Tampilan merespons dalam <50ms dengan debounce blocker, melindungi kasir dari double-charge.'
                          : language === 'zh'
                          ? '每笔意图均携带 RFC4122 UUID v4 唯一键。<50ms 乐观响应与防抖锁，杜绝顾客被重复扣款。'
                          : 'Unique RFC4122 UUID v4 intent keys with <50ms optimistic UI and debounce blockers prevent double-charging.'}
                      </p>
                    </div>
                    <span className="mt-3 inline-block text-[10px] font-mono font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg w-fit">
                      X-Idempotency-Key
                    </span>
                  </div>

                  {/* Pilar 2 */}
                  <div className="bg-white rounded-2xl p-4 border border-orange-100 shadow-xs hover:border-orange-300 transition-all flex flex-col justify-between">
                    <div>
                      <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold mb-2.5">
                        <WifiOff className="w-4 h-4" />
                      </div>
                      <h5 className="text-xs font-bold text-stone-900">
                        {language === 'id'
                          ? '2. Offline Sync Queue'
                          : language === 'zh'
                          ? '2. 离线本地队列容灾'
                          : '2. Offline Sync Queue'}
                      </h5>
                      <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                        {language === 'id'
                          ? 'Saat WiFi drop, pesanan masuk antrian LocalStorage dengan aman. Begitu WiFi pulih, sistem secara otomatis merekonsiliasi antrian ke backend.'
                          : language === 'zh'
                          ? '断网时订单进入本地 Storage 排队。网络恢复后，毫秒级侦测并自动触发批量同步接口。'
                          : 'Orders safely queue in browser storage during drops, auto-reconciling via batch sync upon reconnection.'}
                      </p>
                    </div>
                    <span className="mt-3 inline-block text-[10px] font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg w-fit">
                      Auto-Reconciliation
                    </span>
                  </div>

                  {/* Pilar 3 */}
                  <div className="bg-white rounded-2xl p-4 border border-orange-100 shadow-xs hover:border-orange-300 transition-all flex flex-col justify-between">
                    <div>
                      <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold mb-2.5">
                        <Printer className="w-4 h-4" />
                      </div>
                      <h5 className="text-xs font-bold text-stone-900">
                        {language === 'id'
                          ? '3. Hardware Fault Isolation'
                          : language === 'zh'
                          ? '3. 硬件外设故障隔离'
                          : '3. Hardware Fault Isolation'}
                      </h5>
                      <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                        {language === 'id'
                          ? 'Printer thermal putus atau habis kertas tidak menggagalkan checkout. Pesanan tetap masuk dapur dengan badge "Struk Antri Cetak Ulang".'
                          : language === 'zh'
                          ? '蓝牙小票机断开不影响做单。订单依旧流转后厨，并自动附带待重打黄色告警标。'
                          : 'Printer disconnections do not fail checkout. Orders still reach the kitchen with queued reprint tags.'}
                      </p>
                    </div>
                    <span className="mt-3 inline-block text-[10px] font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg w-fit">
                      QUEUED_FOR_REPRINT
                    </span>
                  </div>
                </div>
              </div>

              {/* Call to Action to Baby Steps */}
              <div className="bg-stone-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center font-bold">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold">
                      {language === 'id'
                        ? 'Siap Mencoba Sendiri?'
                        : language === 'zh'
                        ? '准备好亲自体验了吗？'
                        : 'Ready to Try It Yourself?'}
                    </h5>
                    <p className="text-[11px] text-stone-400">
                      {language === 'id'
                        ? 'Ikuti panduan 5 langkah cepat (Baby Steps) untuk menguji setiap skenario.'
                        : language === 'zh'
                        ? '跟随 5 步简易指南，逐一体验现场混沌测试与容灾机制。'
                        : 'Follow our 5 quick baby steps to test each scenario in real time.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    playTapSound();
                    setActiveTab('steps');
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-all shadow-sm active:scale-95"
                >
                  <span>{language === 'id' ? 'Buka Baby Steps' : language === 'zh' ? '查看新手 5 步' : 'Open Baby Steps'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: BABY STEPS (PANDUAN 5 LANGKAH CEPAT) */}
          {activeTab === 'steps' && (
            <div className="space-y-5">
              {/* Step Navigation Pill Stepper */}
              <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 border-b border-stone-200/80">
                {stepsData.map((s) => (
                  <button
                    key={s.step}
                    onClick={() => {
                      playTapSound();
                      setCurrentStep(s.step);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      currentStep === s.step
                        ? 'bg-orange-500 text-white shadow-xs'
                        : 'text-stone-600 hover:bg-orange-50 hover:text-orange-700'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono ${
                        currentStep === s.step ? 'bg-white/30 text-white' : 'bg-stone-200 text-stone-700'
                      }`}
                    >
                      {s.step}
                    </span>
                    <span className="hidden sm:inline">
                      {s.step === 1 ? 'Pesan Normal' : s.step === 2 ? 'Double-Tap' : s.step === 3 ? 'WiFi Drop' : s.step === 4 ? 'Printer Putus' : 'Root Cause'}
                    </span>
                  </button>
                ))}
              </div>

              {/* Active Step Card */}
              <div className="bg-white rounded-3xl p-5 border border-orange-100 shadow-sm space-y-4">
                {/* Step Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold border border-orange-100 shadow-2xs">
                      {currentStepData.icon}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
                        {currentStepData.scenarioBadge}
                      </span>
                      <h4 className="text-sm font-extrabold text-stone-900">
                        {currentStepData.title}
                      </h4>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold text-stone-400">
                    {t.step_counter} {currentStep} / {stepsData.length}
                  </span>
                </div>

                {/* Scenario Description */}
                <p className="text-xs text-stone-600 leading-relaxed font-medium">
                  {currentStepData.description}
                </p>

                {/* Instructions List */}
                <div className="bg-[#fffaf5] rounded-2xl p-4 border border-orange-100/80 space-y-2.5">
                  <h5 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5 text-orange-500 fill-current" />
                    <span>
                      {language === 'id'
                        ? 'Langkah Cara Mencoba di Website:'
                        : language === 'zh'
                        ? '如何在网页中亲自体验：'
                        : 'How to try it on the website:'}
                    </span>
                  </h5>
                  <ol className="space-y-2 text-xs text-stone-600">
                    {currentStepData.instructions.map((inst, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 font-bold font-mono text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{inst}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Behind the scenes explanation */}
                <div className="bg-stone-50 rounded-2xl p-3 border border-stone-200 text-xs text-stone-600 flex items-start gap-2.5">
                  <Layers className="w-4 h-4 text-stone-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-stone-800 block text-[11px]">
                      {language === 'id'
                        ? 'Arsitektur di Balik Layar:'
                        : language === 'zh'
                        ? '底层架构设计原理：'
                        : 'Under the Hood Architecture:'}
                    </span>
                    <span className="text-[11px] text-stone-500 leading-relaxed">
                      {currentStepData.behindTheScenes}
                    </span>
                  </div>
                </div>

                {/* Step Action Buttons */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        playTapSound();
                        setCurrentStep((s) => Math.max(1, s - 1));
                      }}
                      disabled={currentStep === 1}
                      className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>{t.step_prev}</span>
                    </button>

                    <button
                      onClick={() => {
                        playTapSound();
                        setCurrentStep((s) => Math.min(stepsData.length, s + 1));
                      }}
                      disabled={currentStep === stepsData.length}
                      className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <span>{t.step_next}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Try This Step Action Button */}
                  <button
                    onClick={() => handleTryScenario(currentStepData.targetMode)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 active:scale-95 transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{currentStepData.actionText}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex-shrink-0 px-6 py-3.5 bg-white border-t border-orange-100 flex flex-wrap items-center justify-between gap-3">
          {/* Checkbox: Don't show again */}
          <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-600 hover:text-stone-900 select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={handleToggleDontShowAgain}
              className="w-4 h-4 rounded border-stone-300 text-orange-500 focus:ring-orange-400 focus:ring-offset-0 transition-colors"
            />
            <span>{t.dont_show_again}</span>
          </label>

          {/* Action Close / Start Exploring */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-sm shadow-orange-500/20 active:scale-95 transition-all"
            >
              {t.btn_start_exploring}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
