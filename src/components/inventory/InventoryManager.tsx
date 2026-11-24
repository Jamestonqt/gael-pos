import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, ProductCategory } from '../../types';
import { formatPeso } from '../../utils/formatters';
import { CategoryIcon } from '../../utils/categoryIcons';
import { CategoryManagerModal } from '../common/CategoryManagerModal';
import { InventoryScannerModal } from './InventoryScannerModal';
import { CsvImportModal } from './CsvImportModal';
import { exportProductsToCsv, parseInventoryFile, ParsedCsvResult } from '../../utils/csvInventory';
import { playSound } from '../../utils/audio';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Edit2,
  Trash2,
  Boxes,
  X,
  Wine,
  FolderPlus,
  Tag,
  Camera,
  Sparkles,
  CheckCircle2,
  Download,
  Upload,
} from 'lucide-react';

export const InventoryManager: React.FC = () => {
  const { products, restockProductByPack, saveProduct, deleteProduct, categories, importProductsFromCsv, clearAllProducts } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('All');
  const [stockFilter, setStockFilter] = useState<'all' | 'low-stock' | 'out-of-stock'>('all');

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannedFeedback, setScannedFeedback] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<'name' | 'price' | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  // CSV Import / Export state
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvParsedData, setCsvParsedData] = useState<ParsedCsvResult | null>(null);
  const [csvFeedback, setCsvFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Multi-select / Bulk Delete checklist state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Auto focus input when modal opens
  useEffect(() => {
    if (showProductModal && focusTarget) {
      const timer = setTimeout(() => {
        if (focusTarget === 'price') {
          priceInputRef.current?.focus();
          priceInputRef.current?.select();
        } else {
          nameInputRef.current?.focus();
          nameInputRef.current?.select();
        }
        setFocusTarget(null);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [showProductModal, focusTarget]);

  // Auto fallback to 'All' if selected category is deleted
  useEffect(() => {
    if (selectedCategory !== 'All' && !categories.includes(selectedCategory)) {
      setSelectedCategory('All');
    }
  }, [categories, selectedCategory]);

  // Keep selected checklist in sync if products are deleted or changed
  useEffect(() => {
    const currentIds = new Set(products.map((p) => p.id));
    setSelectedIds((prev) => prev.filter((id) => currentIds.has(id)));
  }, [products]);

  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [packsInput, setPacksInput] = useState<string>('1');

  // Product form state
  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodBarcode, setProdBarcode] = useState('');
  const [prodCategory, setProdCategory] = useState<ProductCategory>('Snacks');
  const [prodUnit, setProdUnit] = useState('pc');
  const [prodPackSize, setProdPackSize] = useState('12');
  const [prodCost, setProdCost] = useState('10');
  const [prodPrice, setProdPrice] = useState('15');
  const [prodStock, setProdStock] = useState('24');
  const [prodThreshold, setProdThreshold] = useState('6');
  const [prodHasDeposit, setProdHasDeposit] = useState(false);
  const [prodDepositFee, setProdDepositFee] = useState('10');
  const [formError, setFormError] = useState<string | null>(null);

  // Summary Metrics
  const totalProducts = products.length;
  const totalInventoryValue = products.reduce(
    (sum, p) => sum + p.stock_qty * p.cost_price,
    0
  );
  const lowStockCount = products.filter(
    (p) => p.stock_qty > 0 && p.stock_qty <= p.low_stock_threshold
  ).length;
  const outOfStockCount = products.filter((p) => p.stock_qty <= 0).length;

  // Filtered products list
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const matchesSearch =
        !q ||
        (p.name || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q);

      const matchesCat =
        selectedCategory === 'All' || p.category === selectedCategory;

      let matchesStock = true;
      if (stockFilter === 'low-stock') {
        matchesStock = p.stock_qty > 0 && p.stock_qty <= p.low_stock_threshold;
      } else if (stockFilter === 'out-of-stock') {
        matchesStock = p.stock_qty <= 0;
      }

      return matchesSearch && matchesCat && matchesStock;
    });
  }, [products, searchQuery, selectedCategory, stockFilter]);

  // Scan Handlers for Inventory
  const handleExistingProductFromScan = (product: Product) => {
    setShowScannerModal(false);
    handleOpenRestock(product);
    playSound.success();
  };

  const handleNewProductFromScan = (data: {
    barcode: string;
    name?: string;
    brand?: string;
    quantity?: string;
    foundInApi: boolean;
  }) => {
    setShowScannerModal(false);
    setEditingProduct(null);
    setProdBarcode(data.barcode);
    setProdSku(`SKU-${data.barcode.slice(-6) || Date.now().toString().slice(-6)}`);
    setProdUnit('pc');
    setProdPackSize('12');
    setProdCost('10');
    setProdPrice('');
    setProdStock('24');
    setProdThreshold('6');
    setProdHasDeposit(false);
    setProdDepositFee('10');
    setFormError(null);

    if (data.foundInApi && data.name) {
      setProdName(data.name);

      // Auto-detect best category from keywords
      const lower = data.name.toLowerCase();
      if (
        lower.includes('shampoo') ||
        lower.includes('soap') ||
        lower.includes('lotion') ||
        lower.includes('cream') ||
        lower.includes('toothpaste') ||
        lower.includes('sachet')
      ) {
        setProdCategory('Toiletries/Sachets');
      } else if (
        lower.includes('drink') ||
        lower.includes('tea') ||
        lower.includes('juice') ||
        lower.includes('coffee') ||
        lower.includes('beverage') ||
        lower.includes('water') ||
        lower.includes('beer')
      ) {
        setProdCategory('Beverages');
      } else if (
        lower.includes('noodle') ||
        lower.includes('canton') ||
        lower.includes('soup') ||
        lower.includes('pancit')
      ) {
        setProdCategory('Instant Noodles');
      } else if (
        lower.includes('sardine') ||
        lower.includes('tuna') ||
        lower.includes('corned') ||
        lower.includes('meat') ||
        lower.includes('can')
      ) {
        setProdCategory('Canned Goods');
      } else {
        setProdCategory('Snacks');
      }

      setScannedFeedback(`Barcode ${data.barcode} recognized! Enter selling price & stock.`);
      setFocusTarget('price');
    } else {
      setProdName('');
      setProdCategory('Snacks');
      setScannedFeedback(`Barcode ${data.barcode} saved. Enter product name manually.`);
      setFocusTarget('name');
    }

    setShowProductModal(true);
  };

  // Open manual add modal (100% preserves existing manual workflow)
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setScannedFeedback(null);
    setProdName('');
    setProdSku(`SKU-${Date.now().toString().slice(-6)}`);
    setProdBarcode('');
    setProdCategory('Snacks');
    setProdUnit('pc');
    setProdPackSize('12');
    setProdCost('10');
    setProdPrice('15');
    setProdStock('24');
    setProdThreshold('6');
    setProdHasDeposit(false);
    setProdDepositFee('10');
    setFormError(null);
    setFocusTarget('name');
    setShowProductModal(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setScannedFeedback(null);
    setProdName(p.name);
    setProdSku(p.sku);
    setProdBarcode(p.barcode);
    setProdCategory(p.category);
    setProdUnit(p.unit_label || 'pc');
    setProdPackSize(p.pack_size.toString());
    setProdCost(p.cost_price.toString());
    setProdPrice(p.selling_price.toString());
    setProdStock(p.stock_qty.toString());
    setProdThreshold(p.low_stock_threshold.toString());
    setProdHasDeposit(p.has_bottle_deposit);
    setProdDepositFee(p.bottle_deposit_fee?.toString() || '10');
    setFormError(null);
    setFocusTarget('name');
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) {
      setFormError('Product name is required.');
      return;
    }
    const cost = parseFloat(prodCost) || 0;
    const price = parseFloat(prodPrice);
    if (isNaN(price) || price <= 0) {
      setFormError('Valid selling price greater than ₱0 is required.');
      return;
    }

    await saveProduct({
      id: editingProduct?.id,
      sku: prodSku.trim(),
      barcode: prodBarcode.trim(),
      name: prodName.trim(),
      category: prodCategory,
      unit_label: prodUnit.trim() || 'pc',
      pack_size: parseInt(prodPackSize) || 1,
      cost_price: cost,
      selling_price: price,
      stock_qty: parseInt(prodStock) || 0,
      low_stock_threshold: parseInt(prodThreshold) || 5,
      has_bottle_deposit: prodHasDeposit,
      bottle_deposit_fee: prodHasDeposit ? parseFloat(prodDepositFee) || 10 : 0,
      is_active: true,
    });

    setShowProductModal(false);
  };

  // Open Restock Modal
  const handleOpenRestock = (p: Product) => {
    setRestockTarget(p);
    setPacksInput('1');
    setShowRestockModal(true);
  };

  const handleConfirmRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockTarget) return;

    const count = parseInt(packsInput) || 0;
    if (count <= 0) return;

    await restockProductByPack(restockTarget.id, count);
    setShowRestockModal(false);
    setRestockTarget(null);
  };

  const handleDelete = async (productId: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      const res = await deleteProduct(productId);
      if (res && !res.success && res.error) {
        playSound.warning();
        setCsvFeedback({
          type: 'error',
          message: `Could not delete "${name}" from cloud: ${res.error}`,
        });
        setTimeout(() => setCsvFeedback(null), 12000);
      } else {
        playSound.tap();
        setCsvFeedback({
          type: 'success',
          message: `"${name}" deleted successfully from local storage & Supabase.`,
        });
        setTimeout(() => setCsvFeedback(null), 4000);
      }
    }
  };

  const handleClearAllProducts = async () => {
    if (products.length === 0) return;
    const count = products.length;
    const confirmed = window.confirm(
      `⚠️ Delete ALL ${count} products?\n\nThis cannot be undone. Export a CSV backup first if you want to restore later.`
    );
    if (!confirmed) return;

    const res = await clearAllProducts();
    setSelectedIds([]);
    if (res && !res.success && res.error) {
      playSound.warning();
      setCsvFeedback({
        type: 'error',
        message: `Local products cleared, but Supabase deletion returned error: ${res.error}`,
      });
      setTimeout(() => setCsvFeedback(null), 12000);
    } else {
      playSound.warning();
      setCsvFeedback({
        type: 'success',
        message: `All ${count} products deleted from local storage & Supabase. Your inventory is now empty.`,
      });
      setTimeout(() => setCsvFeedback(null), 5000);
    }
  };

  // ── Multi-select / Bulk Delete Handlers ────────────────────────────────────
  const handleToggleSelect = (id: string) => {
    playSound.tap();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    playSound.tap();
    if (selectedIds.length === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map((p) => p.id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    const confirmed = window.confirm(
      `⚠️ Delete ${count} selected ${count === 1 ? 'product' : 'products'}?\n\nThis will remove them from your store inventory.`
    );
    if (!confirmed) return;

    playSound.tap();
    let failCount = 0;
    let lastError: string | undefined;

    for (const id of selectedIds) {
      const res = await deleteProduct(id);
      if (res && !res.success && res.error) {
        failCount++;
        lastError = res.error;
      }
    }

    setSelectedIds([]);
    if (failCount > 0) {
      playSound.warning();
      setCsvFeedback({
        type: 'error',
        message: `Deleted with issues: ${failCount} item(s) failed on Supabase: ${lastError}`,
      });
      setTimeout(() => setCsvFeedback(null), 12000);
    } else {
      playSound.warning();
      setCsvFeedback({
        type: 'success',
        message: `Successfully deleted ${count} ${count === 1 ? 'product' : 'products'} from local storage & Supabase.`,
      });
      setTimeout(() => setCsvFeedback(null), 4000);
    }
  };

  // ── CSV Export ────────────────────────────────────────────────────────────
  const handleExportCsv = () => {
    playSound.tap();
    setIsExporting(true);
    try {
      exportProductsToCsv(products);
      setCsvFeedback({ type: 'success', message: `Exported ${products.length} products to CSV.` });
    } catch {
      setCsvFeedback({ type: 'error', message: 'Export failed. Please try again.' });
    } finally {
      setIsExporting(false);
      setTimeout(() => setCsvFeedback(null), 4000);
    }
  };

  // ── CSV Import ────────────────────────────────────────────────────────────
  const handleImportFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    playSound.tap();
    const result = await parseInventoryFile(file);
    if (result.error || result.items.length === 0) {
      setCsvFeedback({ type: 'error', message: result.error || 'No valid products found in file.' });
      setTimeout(() => setCsvFeedback(null), 5000);
    } else {
      setCsvParsedData(result);
      setShowCsvModal(true);
    }
    e.target.value = '';
  };

  const handleCsvImportConfirm = async (mode: 'merge' | 'replace') => {
    if (!csvParsedData) return;
    try {
      const result = await importProductsFromCsv(csvParsedData.items, mode);
      setShowCsvModal(false);
      setCsvParsedData(null);
      if (result.success) {
        playSound.success();
        const msg =
          mode === 'replace'
            ? `Restored ${result.importedCount} products to IndexedDB & Supabase.`
            : `Synced to IndexedDB & Supabase: ${result.importedCount} new, ${result.updatedCount} updated.`;
        setCsvFeedback({ type: 'success', message: msg });
        setTimeout(() => setCsvFeedback(null), 6000);
      } else {
        playSound.warning();
        setCsvFeedback({
          type: 'error',
          message: result.error || 'Import failed. Could not sync products to database.',
        });
        setTimeout(() => setCsvFeedback(null), 12000);
      }
    } catch (err: any) {
      setShowCsvModal(false);
      setCsvParsedData(null);
      playSound.warning();
      setCsvFeedback({
        type: 'error',
        message: err?.message || 'Unexpected error during CSV import.',
      });
      setTimeout(() => setCsvFeedback(null), 12000);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Products
        </div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {totalProducts} items
        </div>
      </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <Package className="w-5 h-5" />
      </div>
    </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Inventory Cost Value
        </div>
            <div className="text-2xl font-black text-amber-600 mt-0.5">
              {formatPeso(totalInventoryValue)}
        </div>
      </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
            <Boxes className="w-5 h-5" />
      </div>
    </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Low Stock Warnings
        </div>
            <div className="text-2xl font-black text-amber-600 mt-0.5">
              {lowStockCount} items
        </div>
      </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
            <AlertTriangle className="w-5 h-5" />
      </div>
    </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Out of Stock
        </div>
            <div className="text-2xl font-black text-red-600 mt-0.5">
              {outOfStockCount} items
        </div>
      </div>
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-700">
            <AlertTriangle className="w-5 h-5" />
      </div>
    </div>
  </div>

      {/* Action Controls & Search Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, barcode, or SKU..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
          />
    </div>

        <div className="flex items-center gap-2">
          {/* Stock Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl">
            <button
              onClick={() => setStockFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                stockFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStockFilter('low-stock')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                stockFilter === 'low-stock'
                  ? 'bg-white text-amber-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Low Stock ({lowStockCount})
            </button>
            <button
              onClick={() => setStockFilter('out-of-stock')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                stockFilter === 'out-of-stock'
                  ? 'bg-white text-red-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Out of Stock ({outOfStockCount})
            </button>
      </div>

          {/* Scan Barcode to Add / Restock Button */}
          <button
            onClick={() => {
              playSound.tap();
              setShowScannerModal(true);
            }}
            className="touch-btn flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm shrink-0 border border-slate-700"
            title="Scan barcode with camera to add new item or restock existing item"
          >
            <Camera className="w-4 h-4 text-brand-400" />
            <span>Scan to Add / Restock</span>
          </button>

          {/* Export CSV button */}
          <button
            onClick={handleExportCsv}
            disabled={isExporting || products.length === 0}
            className="touch-btn flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm shrink-0"
            title="Export all products to a CSV spreadsheet"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          {/* Import CSV button */}
          <button
            onClick={() => { playSound.tap(); csvInputRef.current?.click(); }}
            className="touch-btn flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm shrink-0"
            title="Import or restore inventory from a CSV or Excel spreadsheet"
          >
            <Upload className="w-4 h-4" />
            <span>Import CSV</span>
          </button>

          {/* Clear All Products — danger zone */}
          {products.length > 0 && (
            <button
              onClick={handleClearAllProducts}
              className="touch-btn flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm shrink-0"
              title="Delete every product in this inventory"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear All</span>
            </button>
          )}

          {/* Hidden CSV file input */}
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="sr-only"
            onChange={handleImportFileSelected}
          />

          {/* Add Product Button (Existing manual workflow completely intact) */}
          <button
            onClick={handleOpenAdd}
            className="touch-btn flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm shrink-0"
            title="Add product manually without barcode"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Add Product</span>
          </button>
    </div>
  </div>

      {/* CSV Feedback Banner / Toast */}
      {csvFeedback && (
        <div
          role="alert"
          className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold shadow-sm transition-all animate-fade-in ${
            csvFeedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {csvFeedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
            )}
            <span className="break-words leading-relaxed">{csvFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setCsvFeedback(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 shrink-0"
            aria-label="Dismiss message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('All')}
          className={`touch-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
            selectedCategory === 'All'
              ? 'bg-slate-900 text-brand-300 border-slate-900 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <CategoryIcon category="All" className="w-3.5 h-3.5" />
          <span>All</span>
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`touch-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              selectedCategory === cat
                ? 'bg-slate-900 text-brand-300 border-slate-900 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <CategoryIcon category={cat} className="w-3.5 h-3.5" />
            <span>{cat}</span>
          </button>
        ))}

        {/* Manage Categories Button */}
        <button
          type="button"
          onClick={() => setShowCategoryModal(true)}
          className="touch-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 hover:border-amber-300 transition-all shrink-0 shadow-2xs"
          title="Manage product categories"
        >
          <FolderPlus className="w-3.5 h-3.5 text-amber-600" />
          <span>Manage Categories</span>
        </button>
      </div>

      {/* Bulk Selection / Delete Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm transition-all">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs shadow-2xs">
              {selectedIds.length}
            </div>
            <div>
              <div className="font-bold text-slate-900 text-xs sm:text-sm">
                {selectedIds.length} {selectedIds.length === 1 ? 'product' : 'products'} selected
              </div>
              <div className="text-[11px] text-slate-600 font-medium">
                Click "Delete Selected" to remove checked items, or deselect all.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="touch-btn px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-300 shadow-2xs transition"
            >
              Deselect All
            </button>

            <button
              type="button"
              onClick={handleDeleteSelected}
              className="touch-btn flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-sm transition"
              title="Delete all selected items"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Selected ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Products Table (Desktop & Mobile Responsive) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredProducts.length > 0 && selectedIds.length === filteredProducts.length}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer accent-brand-600"
                    title={
                      filteredProducts.length > 0 && selectedIds.length === filteredProducts.length
                        ? 'Deselect all products'
                        : 'Select all products'
                    }
                    aria-label="Select all products"
                  />
                </th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Cost Price</th>
                <th className="py-3 px-3 text-right">Selling Price</th>
                <th className="py-3 px-3 text-right">Profit / Unit</th>
                <th className="py-3 px-3 text-center">Stock Balance</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Package className="w-10 h-10 stroke-[1.5] text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700">No products found in this list.</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isSelected = selectedIds.includes(p.id);
                  const profitPerPiece = p.selling_price - p.cost_price;
                  const marginPercent =
                    p.selling_price > 0 ? (profitPerPiece / p.selling_price) * 100 : 0;
                  const isOutOfStock = p.stock_qty <= 0;
                  const isLowStock = !isOutOfStock && p.stock_qty <= p.low_stock_threshold;

                  return (
                    <tr
                      key={p.id}
                      className={`transition ${
                        isSelected
                          ? 'bg-amber-100/50 hover:bg-amber-100/70'
                          : 'hover:bg-amber-50/30'
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(p.id)}
                          className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer accent-brand-600"
                          aria-label={`Select ${p.name}`}
                        />
                      </td>

                      {/* Name & SKU */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">
                          {p.name}
                    </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                          {p.sku && <span>SKU: {p.sku}</span>}
                          {p.barcode && <span>Barcode: {p.barcode}</span>}
                          {p.has_bottle_deposit && (
                            <span className="text-amber-800 font-bold flex items-center gap-0.5">
                              <Wine className="w-3 h-3" />
                              Deposit: {formatPeso(p.bottle_deposit_fee || 10)}
                            </span>
                          )}
                    </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded text-[11px]">
                          <CategoryIcon category={p.category} className="w-3 h-3 text-slate-500" />
                          <span>{p.category}</span>
                        </span>
                        <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                          Pack: {p.pack_size} pcs
                        </div>
                      </td>

                      {/* Cost */}
                      <td className="py-3 px-3 text-right font-mono font-medium text-slate-600">
                        {formatPeso(p.cost_price)}
                      </td>

                      {/* Selling Price */}
                      <td className="py-3 px-3 text-right font-mono font-black text-slate-950 text-xs sm:text-sm">
                        {formatPeso(p.selling_price)}
                      </td>

                      {/* Profit per piece */}
                      <td className="py-3 px-3 text-right">
                        <div className="font-mono font-bold text-emerald-700">
                          +{formatPeso(profitPerPiece)}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {marginPercent.toFixed(0)}% margin
                        </div>
                      </td>

                      {/* Stock in pieces */}
                      <td className="py-3 px-3 text-center">
                        <div
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-black text-xs ${
                            isOutOfStock
                              ? 'bg-red-100 text-red-700'
                              : isLowStock
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isLowStock && <AlertTriangle className="w-3 h-3" />}
                          <span>{p.stock_qty} pcs</span>
                    </div>
                        {isLowStock && (
                          <div className="text-[10px] text-amber-700 font-bold mt-0.5">
                            Threshold: {p.low_stock_threshold}
                      </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Restock by Pack/Case */}
                          <button
                            onClick={() => handleOpenRestock(p)}
                            className="touch-btn flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] shadow-sm"
                            title="Restock Wholesale Pack / Case"
                          >
                            <Boxes className="w-3.5 h-3.5" />
                            <span>Restock Pack</span>
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="touch-btn p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                            title="Edit Product"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            className="touch-btn p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                    </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
    </div>
  </div>

      {/* Restock by Pack/Case Modal */}
      {showRestockModal && restockTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 font-bold">
                  <Boxes className="w-5 h-5" />
            </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">Restock by Pack / Case</h3>
                  <p className="text-xs text-slate-500 truncate max-w-[200px]">{restockTarget.name}</p>
            </div>
          </div>
              <button
                onClick={() => setShowRestockModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
        </div>

            <form onSubmit={handleConfirmRestock} className="py-4 space-y-3.5">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Stock:</span>
                  <span className="font-bold text-slate-900">{restockTarget.stock_qty} pcs</span>
            </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pack / Case Size:</span>
                  <span className="font-bold text-amber-700">
                    {restockTarget.pack_size} pcs per pack/case
                  </span>
            </div>
          </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Packs / Cases Received
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={packsInput}
                  onChange={(e) => setPacksInput(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl font-black text-2xl text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                  autoFocus
                />

                {/* Quick Presets */}
                <div className="flex justify-center gap-2 mt-2">
                  {[1, 2, 3, 5, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPacksInput(num.toString())}
                      className="touch-btn px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800"
                    >
                      {num} {num === 1 ? 'pack' : 'packs'}
                    </button>
                  ))}
            </div>
          </div>

              {/* Conversion Preview */}
              {parseInt(packsInput) > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between text-emerald-900 font-bold">
                    <span>Units to Add:</span>
                    <span>
                      +{parseInt(packsInput) * restockTarget.pack_size} pcs ({packsInput} x {restockTarget.pack_size})
                    </span>
              </div>
                  <div className="flex justify-between text-emerald-950 font-black text-sm pt-1 border-t border-emerald-200">
                    <span>New Total Stock:</span>
                    <span>
                      {restockTarget.stock_qty + parseInt(packsInput) * restockTarget.pack_size} pcs
                    </span>
              </div>
            </div>
              )}

              <div className="pt-2 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRestockModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="touch-btn px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md"
                >
                  Confirm Restock
                </button>
          </div>
            </form>
      </div>
    </div>
      )}

      {/* Add / Edit Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-black text-lg text-slate-900">
                {editingProduct ? 'Edit Product Details' : 'Add New Product'}
              </h3>
              <button
                onClick={() => setShowProductModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
        </div>

            <form onSubmit={handleSaveProduct} className="py-4 space-y-3.5">
              {scannedFeedback && (
                <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl text-brand-900 text-xs font-bold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-600 shrink-0" />
                  <span>{scannedFeedback}</span>
                </div>
              )}

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold">
                  {formError}
            </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="e.g. Lucky Me Pancit Canton Kalamansi"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
          </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Category
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCategoryModal(true)}
                      className="text-[11px] font-bold text-brand-600 hover:text-brand-700 underline flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Manage</span>
                    </button>
              </div>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value as ProductCategory)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-white"
                  >
                    {categories.filter((c) => c !== 'All').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
            </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Unit Label
                  </label>
                  <input
                    type="text"
                    value={prodUnit}
                    onChange={(e) => setProdUnit(e.target.value)}
                    placeholder="pc, can, bottle, sachet"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800"
                  />
            </div>
          </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    SKU Code
                  </label>
                  <input
                    type="text"
                    value={prodSku}
                    onChange={(e) => setProdSku(e.target.value)}
                    placeholder="e.g. LM-KAL-60"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800"
                  />
            </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Barcode
                  </label>
                  <input
                    type="text"
                    value={prodBarcode}
                    onChange={(e) => setProdBarcode(e.target.value)}
                    placeholder="e.g. 4800016550215"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800"
                  />
            </div>
          </div>

              {/* Pricing & Costs */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Cost Price (₱)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold">₱</span>
                    <input
                      type="number"
                      step="0.50"
                      value={prodCost}
                      onChange={(e) => setProdCost(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white"
                      required
                    />
              </div>
            </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Selling Price (₱) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold">₱</span>
                    <input
                      ref={priceInputRef}
                      type="number"
                      step="0.50"
                      value={prodPrice}
                      onChange={(e) => setProdPrice(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg font-black text-slate-900 bg-white"
                      required
                    />
              </div>
            </div>
          </div>

              {/* Stock and Pack Size */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Pack / Case Size
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={prodPackSize}
                    onChange={(e) => setProdPackSize(e.target.value)}
                    placeholder="12"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800"
                    title="Number of pieces in a wholesale pack/case"
                  />
            </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Stock in Pieces
                  </label>
                  <input
                    type="number"
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800"
                  />
            </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Low Stock Threshold
                  </label>
                  <input
                    type="number"
                    value={prodThreshold}
                    onChange={(e) => setProdThreshold(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800"
                  />
            </div>
          </div>

              {/* Returnable Bottle Deposit Option */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prodHasDeposit}
                    onChange={(e) => setProdHasDeposit(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-brand-500"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Requires Returnable Glass Bottle Deposit (e.g. Coke Kasalo, Beer)
                  </span>
                </label>

                {prodHasDeposit && (
                  <div className="pl-6 pt-1">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Bottle Deposit Amount (₱)
                    </label>
                    <div className="relative max-w-[160px]">
                      <span className="absolute left-3 top-2 text-slate-400 font-bold">₱</span>
                      <input
                        type="number"
                        step="1"
                        value={prodDepositFee}
                        onChange={(e) => setProdDepositFee(e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white"
                      />
                </div>
              </div>
                )}
          </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="touch-btn px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-black text-xs sm:text-sm shadow-md"
                >
                  {editingProduct ? 'Update Product' : 'Save Product'}
                </button>
          </div>
            </form>
      </div>
    </div>
      )}

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onSelectCategory={(newCat) => setProdCategory(newCat)}
      />

      {/* Inventory Barcode Scanner Modal */}
      <InventoryScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onExistingProductFound={handleExistingProductFromScan}
        onNewProductScanned={handleNewProductFromScan}
      />

      {/* CSV Import Preview Modal */}
      <CsvImportModal
        isOpen={showCsvModal}
        onClose={() => { setShowCsvModal(false); setCsvParsedData(null); }}
        parsedData={csvParsedData}
        onConfirm={handleCsvImportConfirm}
      />
    </div>
  );
};
