import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, ProductCategory } from '../../types';
import { formatPeso } from '../../utils/formatters';
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
} from 'lucide-react';

const CATEGORIES: ProductCategory[] = [
  'All',
  'Beverages',
  'Canned Goods',
  'Instant Noodles',
  'Snacks',
  'Toiletries/Sachets',
  'Other',
];

export const InventoryManager: React.FC = () => {
  const { products, restockProductByPack, saveProduct, deleteProduct } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('All');
  const [stockFilter, setStockFilter] = useState<'all' | 'low-stock' | 'out-of-stock'>('all');

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

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
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q);

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

  // Open add/edit modal
  const handleOpenAdd = () => {
    setEditingProduct(null);
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
    setShowProductModal(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
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
      await deleteProduct(productId);
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
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, barcode, or SKU..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
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

          {/* Add Product Button */}
          <button
            onClick={handleOpenAdd}
            className="touch-btn flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Add Product</span>
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`touch-btn px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              selectedCategory === cat
                ? 'bg-slate-900 text-amber-400 border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Products Table (Desktop & Mobile Responsive) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
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
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Package className="w-10 h-10 stroke-[1.5] text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700">No products found in this list.</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const profitPerPiece = p.selling_price - p.cost_price;
                  const marginPercent =
                    p.selling_price > 0 ? (profitPerPiece / p.selling_price) * 100 : 0;
                  const isOutOfStock = p.stock_qty <= 0;
                  const isLowStock = !isOutOfStock && p.stock_qty <= p.low_stock_threshold;

                  return (
                    <tr key={p.id} className="hover:bg-amber-50/30 transition">
                      {/* Name & SKU */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">
                          {p.name}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          {p.sku && <span>SKU: {p.sku}</span>}
                          {p.barcode && <span>Barcode: {p.barcode}</span>}
                          {p.has_bottle_deposit && (
                            <span className="text-amber-700 font-bold flex items-center gap-0.5">
                              <Wine className="w-3 h-3" />
                              Deposit: {formatPeso(p.bottle_deposit_fee || 10)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded text-[11px]">
                          {p.category}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Pack: {p.pack_size} pcs
                        </div>
                      </td>

                      {/* Cost */}
                      <td className="py-3 px-3 text-right font-medium text-slate-600">
                        {formatPeso(p.cost_price)}
                      </td>

                      {/* Selling Price */}
                      <td className="py-3 px-3 text-right font-black text-slate-950 text-xs sm:text-sm">
                        {formatPeso(p.selling_price)}
                      </td>

                      {/* Profit per piece */}
                      <td className="py-3 px-3 text-right">
                        <div className="font-bold text-emerald-700">
                          +{formatPeso(profitPerPiece)}
                        </div>
                        <div className="text-[10px] text-slate-400">
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
                  type="text"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="e.g. Lucky Me Pancit Canton Kalamansi"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value as ProductCategory)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-white"
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
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
    </div>
  );
};
