import React, { useState, useEffect } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Navbar } from './components/Navbar';
import { ProductGrid } from './components/pos/ProductGrid';
import { CartPanel } from './components/pos/CartPanel';
import { UtangTracker } from './components/utang/UtangTracker';
import { WalletTracker } from './components/wallet/WalletTracker';
import { InventoryManager } from './components/inventory/InventoryManager';
import { DailyReport } from './components/reports/DailyReport';
import { Download, Sparkles, X } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { isLoading, cart } = useStore();
  const [activeTab, setActiveTab] = useState<'pos' | 'utang' | 'wallet' | 'inventory' | 'reports'>('pos');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-2xl p-2 mb-4 animate-pulse">
          <img src="/logo.jpg" alt="Gael Store" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-2xl font-black tracking-tight">Gael Store POS</h1>
        <p className="text-blue-400 font-bold text-xs uppercase tracking-widest mt-1">
          Retail Store Point of Sale
        </p>
        <div className="flex items-center gap-2 mt-6 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>Initializing offline database...</span>
        </div>
      </div>
    );
  }

  const cartItemsCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800">
      {/* Top Navigation */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* PWA Home Screen Install Banner (when available) */}
      {showInstallBanner && (
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 text-white px-4 py-2 flex items-center justify-between text-xs font-bold shadow-sm print:hidden">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 fill-white/20" />
            <span>Install Gael Store on your Home Screen to work completely offline!</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="px-3 py-1 bg-slate-950 text-white rounded-lg hover:bg-slate-900 text-xs font-black shadow-sm flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
            <button
              onClick={() => setShowInstallBanner(false)}
              className="p-1 hover:bg-brand-800 rounded"
              aria-label="Dismiss install banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-4">
        {activeTab === 'pos' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[calc(100dvh-7.5rem)] lg:h-[calc(100vh-7.5rem)] lg:min-h-[560px]">
            {/* Left: Product Grid & Live Search (7 cols on desktop) */}
            <div className="lg:col-span-7 flex flex-col h-full min-h-0">
              <ProductGrid />
            </div>

            {/* Right: Shopping Cart Panel & Instant Change Calculator (5 cols on desktop) */}
            <div
              className={`lg:col-span-5 h-full min-h-0 ${
                mobileCartOpen
                  ? 'fixed inset-0 z-50 p-3 sm:p-4 bg-black/70 backdrop-blur-sm lg:relative lg:p-0 lg:bg-transparent'
                  : 'hidden lg:block'
              }`}
            >
              <div className="h-full relative flex flex-col">
                {mobileCartOpen && (
                  <button
                    onClick={() => setMobileCartOpen(false)}
                    className="lg:hidden absolute top-2 right-2 text-white bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shadow-lg z-10"
                  >
                    <X className="w-4 h-4" />
                    <span>Close Cart</span>
                  </button>
                )}
                <CartPanel />
              </div>
            </div>

            {/* Floating Mobile Cart Toggle Button */}
            <div className="lg:hidden fixed bottom-4 right-4 z-30">
              <button
                onClick={() => setMobileCartOpen(true)}
                aria-label={`Open Cart (${cartItemsCount} items)`}
                className="touch-btn flex items-center gap-2 px-5 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-black rounded-2xl shadow-xl shadow-brand-600/30 border border-brand-500"
              >
                <span>🛒 Cart</span>
                {cartItemsCount > 0 && (
                  <span className="px-2 py-0.5 bg-white text-brand-700 text-xs rounded-full">
                    {cartItemsCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'utang' && <UtangTracker />}

        {activeTab === 'wallet' && <WalletTracker />}

        {activeTab === 'inventory' && <InventoryManager />}

        {activeTab === 'reports' && <DailyReport />}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <StoreProvider>
      <MainLayout />
    </StoreProvider>
  );
};

export default App;
