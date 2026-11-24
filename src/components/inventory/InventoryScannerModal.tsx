import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Product } from '../../types';
import { useStore } from '../../context/StoreContext';
import { playSound } from '../../utils/audio';
import { lookupBarcodeOnline } from '../../utils/barcodeLookup';
import {
  Camera,
  X,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Loader2,
  Barcode,
  Search,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface InventoryScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExistingProductFound: (product: Product) => void;
  onNewProductScanned: (data: {
    barcode: string;
    name?: string;
    brand?: string;
    quantity?: string;
    foundInApi: boolean;
  }) => void;
}

export const InventoryScannerModal: React.FC<InventoryScannerModalProps> = ({
  isOpen,
  onClose,
  onExistingProductFound,
  onNewProductScanned,
}) => {
  const { products } = useStore();

  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isHttpsWarning, setIsHttpsWarning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // Status feedback state
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'existing' | 'searching' | 'not_found' | 'found';
    text: string;
  } | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const isProcessingScanRef = useRef<boolean>(false);
  const containerId = 'inventory-barcode-scanner';

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
          'Camera access requires a secure connection (HTTPS) or localhost. You can still enter or scan with a USB barcode scanner below.'
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
        handleClose();
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
      // Wait for DOM container to mount
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
            const boxWidth = Math.floor(minEdge * 0.8);
            const boxHeight = Math.floor(minEdge * 0.58);
            return { width: boxWidth, height: boxHeight };
          },
          aspectRatio: 1.333333,
        },
        handleScannedCode,
        () => {
          // Expected per-frame when no barcode is in view
        }
      );

      setScannerActive(true);

      // Check for torch capability
      try {
        const capabilities = html5QrCodeRef.current.getRunningTrackCapabilities();
        if ((capabilities as any).torch) {
          setHasTorch(true);
        }
      } catch {
        // Torch inspection unsupported
      }
    } catch (err: any) {
      console.error('Inventory barcode scanner start error:', err);
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

  const handleClose = async () => {
    playSound.tap();
    await stopScanner();
    onClose();
  };

  const handleScannedCode = async (decodedText: string) => {
    if (isProcessingScanRef.current) return;
    const cleanCode = decodedText.trim();
    if (!cleanCode) return;

    isProcessingScanRef.current = true;
    setIsProcessing(true);
    playSound.scanBeep();

    const cleanLower = cleanCode.toLowerCase();
    const cleanStripped = cleanLower.replace(/^0+/, '');

    // 1. Check if barcode already exists in current store inventory
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
      // Existing product found -> Route to Restock mode
      setStatusMessage({
        type: 'existing',
        text: `Existing item found: "${matchedProduct.name}" — opening restock mode...`,
      });
      playSound.success();

      setTimeout(async () => {
        await stopScanner();
        isProcessingScanRef.current = false;
        setIsProcessing(false);
        setStatusMessage(null);
        onExistingProductFound(matchedProduct);
      }, 700);
      return;
    }

    // 2. Barcode is NOT in current store -> Query public product databases
    setStatusMessage({
      type: 'searching',
      text: 'Looking up product details from public database...',
    });

    const lookupResult = await lookupBarcodeOnline(cleanCode);

    if (lookupResult.found && lookupResult.name) {
      setStatusMessage({
        type: 'found',
        text: `Identified: "${lookupResult.name}" — loading details...`,
      });
      playSound.success();

      setTimeout(async () => {
        await stopScanner();
        isProcessingScanRef.current = false;
        setIsProcessing(false);
        setStatusMessage(null);
        onNewProductScanned({
          barcode: cleanCode,
          name: lookupResult.name,
          brand: lookupResult.brand,
          quantity: lookupResult.quantity,
          foundInApi: true,
        });
      }, 700);
    } else {
      setStatusMessage({
        type: 'not_found',
        text: 'Barcode saved — enter product name manually.',
      });

      setTimeout(async () => {
        await stopScanner();
        isProcessingScanRef.current = false;
        setIsProcessing(false);
        setStatusMessage(null);
        onNewProductScanned({
          barcode: cleanCode,
          foundInApi: false,
        });
      }, 700);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleScannedCode(manualCode);
    setManualCode('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 animate-fade-in">
      <div
        className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scanner-modal-title"
      >
        {/* Header */}
        <div className="px-4 py-3.5 bg-slate-950 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 id="scanner-modal-title" className="text-sm font-bold text-white">
                Scan Barcode to Add / Restock
              </h2>
              <p className="text-[11px] text-slate-400">
                Point camera at item barcode or enter digits below
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {hasTorch && (
              <button
                onClick={toggleTorch}
                title={torchOn ? 'Turn Flashlight Off' : 'Turn Flashlight On'}
                className={`p-2 rounded-xl transition ${
                  torchOn
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              aria-label="Close scanner dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewfinder Area */}
        <div className="p-4 space-y-3">
          {/* Status / Notice Banner */}
          {statusMessage && (
            <div
              className={`p-3 rounded-2xl flex items-center gap-2 text-xs font-bold animate-fade-in ${
                statusMessage.type === 'existing'
                  ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-300'
                  : statusMessage.type === 'searching'
                  ? 'bg-blue-950/80 border border-blue-500 text-blue-300'
                  : statusMessage.type === 'found'
                  ? 'bg-brand-950/80 border border-brand-500 text-brand-300'
                  : 'bg-amber-950/80 border border-amber-500 text-amber-300'
              }`}
            >
              {statusMessage.type === 'searching' ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0 text-blue-400" />
              ) : statusMessage.type === 'existing' || statusMessage.type === 'found' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <Barcode className="w-4 h-4 shrink-0 text-amber-400" />
              )}
              <span className="truncate">{statusMessage.text}</span>
            </div>
          )}

          {/* Camera Viewport */}
          <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-4/3 flex items-center justify-center">
            <div id={containerId} className="w-full h-full" />

            {/* Viewfinder Target Overlays */}
            {scannerActive && !isProcessing && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[78%] h-[58%] border-2 border-brand-400/80 rounded-2xl relative shadow-lg">
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-brand-400/50 animate-pulse" />
                </div>
              </div>
            )}

            {/* Error Overlay */}
            {cameraError && (
              <div className="absolute inset-0 bg-slate-900/90 p-5 flex flex-col items-center justify-center text-center space-y-2">
                <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />
                <p className="text-xs font-bold text-slate-200">{cameraError}</p>
                <p className="text-[11px] text-slate-400">
                  You can type or scan the barcode manually below:
                </p>
              </div>
            )}
          </div>

          {/* Manual Input Fallback */}
          <form onSubmit={handleManualSubmit} className="space-y-1.5">
            <label
              htmlFor="manual-barcode-input"
              className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between"
            >
              <span>Or Type / Scan Barcode:</span>
              <span className="text-[10px] text-slate-500 font-normal">Supports USB/Bluetooth scanner</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Barcode className="w-4 h-4" />
                </div>
                <input
                  id="manual-barcode-input"
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="e.g. 4800016644111 or SKU"
                  disabled={isProcessing}
                  className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <button
                type="submit"
                disabled={isProcessing || !manualCode.trim()}
                className="touch-btn px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition flex items-center gap-1 shrink-0"
              >
                <span>Lookup</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Informational Guidance */}
          <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-[11px] text-slate-400 space-y-1">
            <div className="flex items-start gap-1.5">
              <span className="text-emerald-400 font-bold">•</span>
              <span><strong>Existing Items:</strong> Automatically opens Restock mode without duplicates.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-brand-400 font-bold">•</span>
              <span><strong>New Items:</strong> Queries Open Food & Beauty Facts to auto-fill brand & name.</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="touch-btn px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
