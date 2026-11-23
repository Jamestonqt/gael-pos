import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useStore } from '../../context/StoreContext';
import { Product, ProductCategory } from '../../types';
import { formatPeso } from '../../utils/formatters';
import { playSound } from '../../utils/audio';
import {
  Camera,
  X,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Zap,
  ShoppingBag,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductScanned?: (product: Product) => void;
}

const CATEGORIES: ProductCategory[] = [
  'Beverages',
  'Canned Goods',
  'Instant Noodles',
  'Snacks',
  'Toiletries/Sachets',
  'Other',
];

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onProductScanned,
}) => {
  const { products, addToCart, saveProduct } = useStore();

  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isHttpsWarning, setIsHttpsWarning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [manualInputCode, setManualInputCode] = useState('');

  // Scan feedback toast state
  const [lastScannedToast, setLastScannedToast] = useState<{
    name: string;
    price: number;
    barcode: string;
  } | null>(null);

  // Unregistered barcode state
  const [unrecognizedCode, setUnrecognizedCode] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Quick Add Form fields
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState<ProductCategory>('Snacks');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdCost, setNewProdCost] = useState('');
  const [newProdStock, setNewProdStock] = useState('12');
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const lastScanTimestampRef = useRef<number>(0);
  const isProcessingScanRef = useRef<boolean>(false);
  const containerId = 'gael-pos-barcode-scanner';

  // Check camera support and HTTPS
  useEffect(() => {
    isMountedRef.current = true;
    if (!isOpen) return;

    const isSecure =
      window.isSecureContext ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (!isSecure) {
        setIsHttpsWarning(true);
        setCameraError(
          'Camera access requires a secure connection (HTTPS) or localhost. You can still scan using a handheld USB/Bluetooth barcode scanner or search items manually.'
        );
      } else {
        setCameraError(
          'Camera hardware not detected or camera permissions have been denied on this browser.'
        );
      }
      return;
    }

    setCameraError(null);
    setIsHttpsWarning(false);
    startScanner();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('keydown', handleKeyDown);
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async () => {
    try {
      setCameraError(null);
      // Wait for DOM element to render
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (!isMountedRef.current) return;

      const elem = document.getElementById(containerId);
      if (!elem) return;

      const formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE,
      ];

      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(containerId, {
          formatsToSupport,
          verbose: false,
        });
      }

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const boxWidth = Math.floor(minEdge * 0.78);
            const boxHeight = Math.floor(minEdge * 0.58);
            return { width: boxWidth, height: boxHeight };
          },
          aspectRatio: 1.333333,
        },
        onScanSuccess,
        () => {
          // Frame scan error (expected per frame when no barcode is in view)
        }
      );

      setScannerActive(true);

      // Check if torch / flashlight is supported
      try {
        const capabilities = html5QrCodeRef.current.getRunningTrackCapabilities();
        if ((capabilities as any).torch) {
          setHasTorch(true);
        }
      } catch {
        // Torch capability inspect error
      }
    } catch (err: any) {
      console.error('Barcode scanner start error:', err);
      setCameraError(
        err?.message ||
          'Unable to initialize camera. Please check camera permissions in your browser.'
      );
    }
  };

  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current) {
        try {
          const state = html5QrCodeRef.current.getState();
          // Html5QrcodeScannerState: 2 = SCANNING, 3 = PAUSED
          if (state === 2 || state === 3) {
            await html5QrCodeRef.current.stop();
          }
        } catch {
          // Ignore state stop check errors
        }
        try {
          html5QrCodeRef.current.clear();
        } catch {
          // Ignore clear errors
        }
      }
    } catch (err) {
      console.warn('Scanner stop error:', err);
    } finally {
      html5QrCodeRef.current = null;
      setScannerActive(false);
      setTorchOn(false);
    }
  };

  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as any],
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn('Failed to toggle torch:', err);
    }
  };

  const onScanSuccess = (decodedText: string) => {
    const now = Date.now();
    // Debounce duplicate scans for 1.5 seconds (1500ms)
    if (now - lastScanTimestampRef.current < 1500 || isProcessingScanRef.current) {
      return;
    }

    lastScanTimestampRef.current = now;
    isProcessingScanRef.current = true;

    const cleanCode = decodedText.trim();
    if (!cleanCode) {
      isProcessingScanRef.current = false;
      return;
    }

    // Play classic high-pitch retail POS beep and trigger mobile vibration
    playSound.scanBeep();

    const cleanLower = cleanCode.toLowerCase();
    const cleanStripped = cleanLower.replace(/^0+/, '');

    // Look up barcode or SKU (with support for stripped leading zero)
    const matchedProduct = products.find((p) => {
      if (!p.is_active) return false;
      const pBarcode = (p.barcode || '').trim().toLowerCase();
      const pSku = (p.sku || '').trim().toLowerCase();
      return (
        pBarcode === cleanLower ||
        pSku === cleanLower ||
        (cleanStripped && pBarcode.replace(/^0+/, '') === cleanStripped) ||
        (cleanStripped && pSku.replace(/^0+/, '') === cleanStripped)
      );
    });

    if (matchedProduct) {
      // Product Found! Add to cart
      addToCart(matchedProduct);
      if (onProductScanned) {
        onProductScanned(matchedProduct);
      }

      setLastScannedToast({
        name: matchedProduct.name,
        price: matchedProduct.selling_price,
        barcode: cleanCode,
      });
      setUnrecognizedCode(null);
      setShowQuickAdd(false);

      // Auto dismiss success toast after 3s
      setTimeout(() => {
        setLastScannedToast((prev) => (prev?.barcode === cleanCode ? null : prev));
      }, 3000);
    } else {
      // Unrecognized barcode
      playSound.warning();
      setUnrecognizedCode(cleanCode);
      setLastScannedToast(null);
    }

    setTimeout(() => {
      isProcessingScanRef.current = false;
    }, 600);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInputCode.trim()) return;
    const code = manualInputCode.trim();
    setManualInputCode('');
    lastScanTimestampRef.current = 0;
    isProcessingScanRef.current = false;
    onScanSuccess(code);
  };

  const handleOpenQuickAdd = () => {
    setNewProdName('');
    setNewProdCategory('Snacks');
    setNewProdPrice('');
    setNewProdCost('');
    setNewProdStock('12');
    setQuickAddError(null);
    setShowQuickAdd(true);
  };

  const handleSaveQuickProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unrecognizedCode) return;

    const price = parseFloat(newProdPrice);
    const cost = parseFloat(newProdCost) || 0;
    const stock = parseInt(newProdStock) || 0;

    if (!newProdName.trim()) {
      setQuickAddError('Please enter a product name');
      return;
    }
    if (isNaN(price) || price <= 0) {
      setQuickAddError('Please enter a valid selling price');
      return;
    }

    setIsSavingProduct(true);
    setQuickAddError(null);

    try {
      const created = await saveProduct({
        name: newProdName.trim(),
        barcode: unrecognizedCode,
        sku: `SKU-${unrecognizedCode.slice(-6)}`,
        category: newProdCategory,
        unit_label: 'pc',
        pack_size: 1,
        selling_price: price,
        cost_price: cost,
        stock_qty: stock,
        low_stock_threshold: 5,
        has_bottle_deposit: false,
        bottle_deposit_fee: 0,
        is_active: true,
      });

      // Add newly registered product to cart immediately!
      addToCart(created);
      playSound.success();

      setLastScannedToast({
        name: created.name,
        price: created.selling_price,
        barcode: unrecognizedCode,
      });

      setUnrecognizedCode(null);
      setShowQuickAdd(false);
    } catch (err: any) {
      setQuickAddError(err?.message || 'Failed to save product');
      playSound.warning();
    } finally {
      setIsSavingProduct(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col text-white max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-600/30 text-brand-400 border border-brand-500/40 flex items-center justify-center shadow-glow-brand">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                Barcode Scanner
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </h2>
              <p className="text-[11px] text-slate-400">Point camera at item barcode</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasTorch && (
              <button
                onClick={toggleTorch}
                aria-label={torchOn ? 'Turn Flash Off' : 'Turn Flash On'}
                className={`p-2 rounded-xl border transition ${
                  torchOn
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <Zap className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              aria-label="Close Barcode Scanner"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewfinder Area */}
        <div className="relative bg-black flex-1 flex flex-col items-center justify-center min-h-[290px] overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center max-w-sm space-y-3.5 my-auto">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">
                  {isHttpsWarning ? 'Camera Requires HTTPS or Localhost' : 'Camera Unavailable'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{cameraError}</p>
              </div>

              {/* Direct One-Click Switch to Localhost button if opened over network IP */}
              {isHttpsWarning && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && (
                <a
                  href={`http://localhost:${window.location.port || '4173'}${window.location.pathname}`}
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-3 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs rounded-xl shadow-md transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open on http://localhost:{window.location.port || '4173'}</span>
                </a>
              )}

              {/* Manual Barcode / USB Scanner Input */}
              <div className="pt-2 border-t border-slate-800 text-left">
                <label className="text-[11px] font-bold text-slate-300 mb-1.5 block">
                  Scan with USB barcode gun or enter barcode:
                </label>
                <form onSubmit={handleManualSubmit} className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="e.g. 4800016644800 or SKU"
                    value={manualInputCode}
                    onChange={(e) => setManualInputCode(e.target.value)}
                    className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!manualInputCode.trim()}
                    className="px-3.5 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow transition"
                  >
                    Lookup
                  </button>
                </form>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCameraError(null);
                    setIsHttpsWarning(false);
                    startScanner();
                  }}
                  className="text-brand-400 hover:text-brand-300 font-semibold inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry camera detection
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* HTML5 QR Code Mount Element */}
              <div
                id={containerId}
                className="w-full h-full min-h-[280px] [&>video]:object-cover [&>video]:w-full [&>video]:h-full"
              />

              {/* Viewfinder Target Reticle Overlay */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative w-64 h-44 border border-white/40 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                  {/* Glowing Laser Scan Bar */}
                  <div className="absolute inset-x-2 h-0.5 bg-brand-400 shadow-[0_0_8px_#3b82f6] top-1/2 -translate-y-1/2 animate-pulse" />
                  
                  {/* Corner Accent Ticks */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-white" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-white" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-white" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-white" />

                  <div className="absolute -bottom-7 inset-x-0 text-center">
                    <span className="text-[10px] font-bold text-white/90 bg-black/60 px-2.5 py-0.5 rounded-full border border-white/20">
                      Align barcode inside frame
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Scanned & Added Toast Notification Banner */}
          {lastScannedToast && (
            <div className="absolute top-3 inset-x-3 z-20 bg-emerald-600 text-white p-3 rounded-2xl shadow-xl flex items-center justify-between gap-2 border border-emerald-400 animate-in fade-in slide-in-from-top duration-200">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-100" />
                <div className="min-w-0">
                  <div className="font-extrabold text-xs truncate">
                    Added: {lastScannedToast.name}
                  </div>
                  <div className="text-[11px] text-emerald-100 font-semibold">
                    {formatPeso(lastScannedToast.price)} • In Cart
                  </div>
                </div>
              </div>
              <span className="px-2 py-1 bg-white text-emerald-800 font-black text-xs rounded-xl shrink-0">
                +1 Added
              </span>
            </div>
          )}

          {/* Unrecognized Barcode Prompt */}
          {unrecognizedCode && !showQuickAdd && (
            <div className="absolute bottom-3 inset-x-3 z-20 bg-slate-900/95 border border-amber-500/50 p-4 rounded-2xl shadow-2xl backdrop-blur-md space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Item Not in Inventory</span>
                </div>
                <button
                  onClick={() => setUnrecognizedCode(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-300">
                Scanned barcode:{' '}
                <strong className="text-white font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                  {unrecognizedCode}
                </strong>
              </div>

              <button
                onClick={handleOpenQuickAdd}
                className="touch-btn w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Register as New Product</span>
              </button>
            </div>
          )}
        </div>

        {/* Quick Add Form Drawer (when barcode is unrecognized) */}
        {showQuickAdd && unrecognizedCode && (
          <div className="p-4 bg-slate-950 border-t border-slate-800 max-h-[300px] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
              <h3 className="font-bold text-xs text-white flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-brand-400" />
                Quick Register Barcode: <span className="font-mono text-brand-300">{unrecognizedCode}</span>
              </h3>
              <button
                onClick={() => setShowQuickAdd(false)}
                className="text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickProduct} className="space-y-3">
              {quickAddError && (
                <div className="p-2 bg-red-950/80 border border-red-800 rounded-xl text-red-300 text-xs">
                  {quickAddError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="e.g. Kopiko Brown Coffee 30g"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Category
                  </label>
                  <select
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value as ProductCategory)}
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Selling Price (₱)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Cost Price (₱)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    value={newProdCost}
                    onChange={(e) => setNewProdCost(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                    Initial Stock (pcs)
                  </label>
                  <input
                    type="number"
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="touch-btn flex-1 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-black text-xs shadow-md"
                >
                  {isSavingProduct ? 'Saving...' : 'Save & Add to Cart'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                scannerActive
                  ? 'bg-emerald-400 animate-pulse'
                  : cameraError
                  ? 'bg-amber-400'
                  : 'bg-brand-400'
              }`}
            />
            <span>
              {scannerActive
                ? 'Rear camera active'
                : cameraError
                ? 'Camera inactive (manual input ready)'
                : 'Initializing camera...'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="touch-btn px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700"
          >
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
};
