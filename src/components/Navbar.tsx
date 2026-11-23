import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import {
  Wifi,
  WifiOff,
  Database,
  RefreshCw,
  Download,
  Upload,
  Settings,
  ShoppingBag,
  BookOpen,
  Smartphone,
  Package,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  X,
  KeyRound,
  Clock,
  Sparkles,
} from 'lucide-react';
import { playSound } from '../utils/audio';

interface NavbarProps {
  activeTab: 'pos' | 'utang' | 'wallet' | 'inventory' | 'reports';
  setActiveTab: (tab: 'pos' | 'utang' | 'wallet' | 'inventory' | 'reports') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const {
    syncState,
    syncMessage,
    triggerSync,
    exportBackup,
    importBackup,
    settings,
    updateSettings,
    cart,
  } = useStore();

  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

  // Settings form state
  const [storeName, setStoreName] = useState(settings.store_name);
  const [ownerPin, setOwnerPin] = useState(settings.owner_pin);
  const [confirmPin, setConfirmPin] = useState(settings.owner_pin);
  const [currentPinCheck, setCurrentPinCheck] = useState('');
  const [loadBal, setLoadBal] = useState(settings.load_wallet_balance.toString());
  const [gcashBal, setGcashBal] = useState(settings.gcash_wallet_balance.toString());
  const [drawerBal, setDrawerBal] = useState(settings.cash_drawer_balance.toString());
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  // Real-time live clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      );
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const cartItemsCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const json = await exportBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Gael-Store-Backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupNotice('Backup exported and downloaded successfully!');
      playSound.success();
    } catch (err: any) {
      setBackupNotice(`Export failed: ${err?.message}`);
      playSound.warning();
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      const res = await importBackup(content);
      setBackupNotice(res.message);
      if (res.success) {
        playSound.success();
      } else {
        playSound.warning();
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError(null);
    setSettingsSuccess(null);

    if (ownerPin !== confirmPin) {
      setSettingsError('New PIN and Confirm PIN do not match.');
      playSound.warning();
      return;
    }
    if (ownerPin.length < 4) {
      setSettingsError('Owner PIN must be at least 4 digits.');
      playSound.warning();
      return;
    }

    if (currentPinCheck !== settings.owner_pin) {
      setSettingsError('Current PIN is incorrect. Settings cannot be saved.');
      playSound.warning();
      return;
    }

    const res = await updateSettings(
      {
        store_name: storeName.trim() || 'Gael Store',
        owner_pin: ownerPin,
        load_wallet_balance: parseFloat(loadBal) || 0,
        gcash_wallet_balance: parseFloat(gcashBal) || 0,
        cash_drawer_balance: parseFloat(drawerBal) || 0,
      },
      currentPinCheck
    );

    if (res.success) {
      setSettingsSuccess('Store settings saved successfully!');
      playSound.success();
      setTimeout(() => {
        setShowSettingsModal(false);
        setSettingsSuccess(null);
        setCurrentPinCheck('');
      }, 1200);
    } else {
      setSettingsError(res.error || 'Failed to save settings');
      playSound.warning();
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur text-white shadow-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          {/* Top Brand & Status Bar */}
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
            {/* Logo & Store Identity */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white flex items-center justify-center shadow-md p-1 shrink-0 overflow-hidden border border-slate-700/80">
                <img
                  src="/logo.jpg"
                  alt="Gael Store GS Logo"
                  className="w-full h-full object-contain"
                  width="44"
                  height="44"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-white truncate">
                    Gael Store
                  </h1>
                  <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-brand-500/20 text-brand-400 border border-brand-500/30 rounded">
                    POS
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate hidden md:block">
                  {settings.store_name}
                </p>
              </div>
            </div>

            {/* Middle: Live Clock (Tablet & Desktop) */}
            {currentTime && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-800/80 border border-slate-700/70 rounded-full text-slate-300 text-xs font-mono">
                <Clock className="w-3.5 h-3.5 text-brand-400" />
                <span className="font-bold text-white">{currentTime}</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-300">{currentDate}</span>
              </div>
            )}

            {/* Sync Status Badge & Action Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Sync Status Indicator */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold select-none border transition-colors ${
                  syncState === 'online-synced'
                    ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                    : syncState === 'offline-mode'
                    ? 'bg-amber-950/70 border-amber-500/40 text-amber-300'
                    : syncState === 'syncing'
                    ? 'bg-brand-950/70 border-brand-500/40 text-brand-300 animate-pulse'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
                title={
                  syncState === 'online-synced'
                    ? 'Connected & Synced with Supabase'
                    : syncState === 'offline-mode'
                    ? 'Offline Mode. Stored locally in IndexedDB'
                    : 'Local Only Mode (IndexedDB)'
                }
              >
                {syncState === 'online-synced' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="hidden xs:inline text-[11px]">Synced</span>
                  </>
                )}
                {syncState === 'offline-mode' && (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="hidden xs:inline text-[11px]">Offline</span>
                  </>
                )}
                {syncState === 'local-only' && (
                  <>
                    <Database className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="hidden xs:inline text-[11px]">Local DB</span>
                  </>
                )}
                {syncState === 'syncing' && (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-brand-400 animate-spin shrink-0" />
                    <span className="text-[11px]">Syncing...</span>
                  </>
                )}
              </div>

              {/* Sync Now Button */}
              <button
                onClick={() => {
                  playSound.tap();
                  triggerSync();
                }}
                className="touch-btn p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition flex items-center justify-center"
                title="Sync Now with Cloud Database"
                aria-label="Sync Now"
              >
                <RefreshCw className="w-4 h-4 text-brand-400" />
              </button>

              {/* Backup & Restore Button */}
              <button
                onClick={() => {
                  playSound.tap();
                  setBackupNotice(null);
                  setShowBackupModal(true);
                }}
                className="touch-btn p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition flex items-center justify-center"
                title="Backup and Restore Data"
                aria-label="Backup and Restore Data"
              >
                <Download className="w-4 h-4 text-emerald-400" />
              </button>

              {/* Owner Settings Button */}
              <button
                onClick={() => {
                  playSound.tap();
                  setStoreName(settings.store_name);
                  setOwnerPin(settings.owner_pin);
                  setConfirmPin(settings.owner_pin);
                  setLoadBal(settings.load_wallet_balance.toString());
                  setGcashBal(settings.gcash_wallet_balance.toString());
                  setDrawerBal(settings.cash_drawer_balance.toString());
                  setCurrentPinCheck('');
                  setSettingsError(null);
                  setSettingsSuccess(null);
                  setShowSettingsModal(true);
                }}
                className="touch-btn p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition flex items-center justify-center"
                title="Store Settings & PIN"
                aria-label="Store Settings"
              >
                <Settings className="w-4 h-4 text-slate-300" />
              </button>
            </div>
          </div>

          {/* Sync Message Alert if any */}
          {syncMessage && (
            <div className="pb-2 text-center text-xs font-medium text-amber-300 bg-amber-950/40 rounded px-2 py-1 mb-1 border border-amber-800/40">
              {syncMessage}
            </div>
          )}

          {/* Navigation Tabs */}
          <nav
            aria-label="Main Navigation"
            className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-1.5 scrollbar-none border-t border-slate-800/80"
          >
            <button
              onClick={() => {
                playSound.tap();
                setActiveTab('pos');
              }}
              aria-label="Checkout POS Screen"
              className={`touch-btn flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm shrink-0 transition-all ${
                activeTab === 'pos'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 ring-1 ring-brand-400'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Checkout</span>
              {cartItemsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-white text-brand-700 text-[11px] font-black rounded-full">
                  {cartItemsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                playSound.tap();
                setActiveTab('utang');
              }}
              aria-label="Customer Credit and Utang Ledger"
              className={`touch-btn flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm shrink-0 transition-all ${
                activeTab === 'utang'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 ring-1 ring-brand-400'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Customer Credit</span>
            </button>

            <button
              onClick={() => {
                playSound.tap();
                setActiveTab('wallet');
              }}
              aria-label="E-Load and Digital Wallet Services"
              className={`touch-btn flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm shrink-0 transition-all ${
                activeTab === 'wallet'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 ring-1 ring-brand-400'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>E-Load & GCash</span>
            </button>

            <button
              onClick={() => {
                playSound.tap();
                setActiveTab('inventory');
              }}
              aria-label="Inventory and Pack Restock"
              className={`touch-btn flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm shrink-0 transition-all ${
                activeTab === 'inventory'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 ring-1 ring-brand-400'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Inventory & Restock</span>
            </button>

            <button
              onClick={() => {
                playSound.tap();
                setActiveTab('reports');
              }}
              aria-label="Z-Reading and Daily Profit Reports"
              className={`touch-btn flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm shrink-0 transition-all ${
                activeTab === 'reports'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 ring-1 ring-brand-400'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Z-Reading & Profit</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Backup & Restore Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-brand-600" />
                Data Backup & Restore
              </h2>
              <button
                onClick={() => setShowBackupModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Close Backup Modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <p className="text-sm text-slate-600">
                Gael Store keeps all sales, credit balances, inventory, and logs offline in your browser.
                Export a full JSON backup to keep your store data completely safe.
              </p>

              {backupNotice && (
                <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl text-brand-900 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                  <span>{backupNotice}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="touch-btn flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>{isExporting ? 'Exporting...' : 'Export Backup'}</span>
                </button>

                <label className="touch-btn cursor-pointer flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm shadow-md text-center">
                  <Upload className="w-4 h-4" />
                  <span>Import Backup</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end">
              <button
                onClick={() => setShowBackupModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Owner Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-brand-600" />
                Store Settings & Security PIN
              </h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Close Settings Modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="py-4 space-y-4">
              {settingsError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{settingsError}</span>
                </div>
              )}
              {settingsSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
                  <span>{settingsSuccess}</span>
                </div>
              )}

              {/* Store Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Store Name
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              {/* PIN Settings */}
              <div className="p-3.5 bg-brand-50/70 border border-brand-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-brand-900">
                  <KeyRound className="w-4 h-4 text-brand-600" />
                  <span>Owner PIN (Required for Voiding Sales and Sensitive Settings)</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      New PIN (4 digits)
                    </label>
                    <input
                      type="password"
                      maxLength={8}
                      value={ownerPin}
                      onChange={(e) => setOwnerPin(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg font-bold text-center text-slate-800 bg-white"
                      placeholder="1234"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Confirm PIN
                    </label>
                    <input
                      type="password"
                      maxLength={8}
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg font-bold text-center text-slate-800 bg-white"
                      placeholder="1234"
                    />
                  </div>
                </div>
              </div>

              {/* Drawer & Wallet Initial Balances */}
              <div className="space-y-3 pt-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Current Running Balances
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Cash Drawer
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-bold">₱</span>
                      <input
                        type="number"
                        step="0.01"
                        value={drawerBal}
                        onChange={(e) => setDrawerBal(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 border rounded-xl font-bold text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      GCash / Maya Wallet
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-bold">₱</span>
                      <input
                        type="number"
                        step="0.01"
                        value={gcashBal}
                        onChange={(e) => setGcashBal(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 border rounded-xl font-bold text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Load Wallet
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-bold">₱</span>
                      <input
                        type="number"
                        step="0.01"
                        value={loadBal}
                        onChange={(e) => setLoadBal(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 border rounded-xl font-bold text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Security confirmation PIN */}
              <div className="pt-2 border-t">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Enter Current PIN to Authorize (Default: 1234):
                </label>
                <input
                  type="password"
                  value={currentPinCheck}
                  onChange={(e) => setCurrentPinCheck(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-brand-500"
                  placeholder="Enter current PIN"
                  required
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-black text-sm shadow-md"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
