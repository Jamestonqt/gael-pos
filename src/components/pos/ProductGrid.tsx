import React, { useState, useMemo } from 'react';
import { Product, ProductCategory } from '../../types';
import { useStore } from '../../context/StoreContext';
import { formatPeso } from '../../utils/formatters';
import {
  Search,
  Plus,
  Package,
  AlertCircle,
  Sparkles,
  Barcode,
  X,
  Coffee,
  Soup,
  Cookie,
  Heart,
  Layers,
  Wine,
  Camera,
} from 'lucide-react';
import { CustomTingiModal } from './CustomTingiModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { playSound } from '../../utils/audio';

interface CategoryConfig {
  id: ProductCategory;
  label: string;
  icon: string;
}

const CATEGORIES: CategoryConfig[] = [
  { id: 'All', label: 'All Items', icon: '🔲' },
  { id: 'Beverages', label: 'Beverages', icon: '🥤' },
  { id: 'Canned Goods', label: 'Canned Goods', icon: '🥫' },
  { id: 'Instant Noodles', label: 'Noodles', icon: '🍜' },
  { id: 'Snacks', label: 'Snacks', icon: '🍿' },
  { id: 'Toiletries/Sachets', label: 'Toiletries', icon: '🧴' },
  { id: 'Other', label: 'Other', icon: '📦' },
];

export const ProductGrid: React.FC = () => {
  const { products, addToCart, addCustomCartItem } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);

  // Filter products by category and search (name or barcode)
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter((prod) => {
      if (!prod.is_active) return false;

      const matchesCat =
        selectedCategory === 'All' || prod.category === selectedCategory;

      const matchesSearch =
        !query ||
        prod.name.toLowerCase().includes(query) ||
        prod.barcode.toLowerCase().includes(query) ||
        prod.sku.toLowerCase().includes(query);

      return matchesCat && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const handleProductClick = (product: Product) => {
    playSound.tap();
    addToCart(product);
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Top Search & Custom Manual Item Action */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search Input */}
        <div className="relative flex-1">
          <label htmlFor="pos-search-input" className="sr-only">
            Search products
          </label>
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            id="pos-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search item, barcode, or SKU..."
            className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 font-semibold text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
          />
          {searchQuery ? (
            <button
              onClick={() => {
                playSound.tap();
                setSearchQuery('');
              }}
              aria-label="Clear search query"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => {
                playSound.tap();
                setShowScannerModal(true);
              }}
              aria-label="Scan barcode with camera"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-brand-600 transition"
              title="Open Camera Barcode Scanner"
            >
              <Camera className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Scan Barcode Camera Button */}
        <button
          onClick={() => {
            playSound.tap();
            setShowScannerModal(true);
          }}
          aria-label="Open mobile camera barcode scanner"
          className="touch-btn flex items-center justify-center gap-1.5 px-3.5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-2xl shadow-sm border border-slate-700 shrink-0"
        >
          <Camera className="w-4 h-4 text-brand-400" />
          <span>Scan Barcode</span>
        </button>

        {/* Custom Tingi / Manual Item Button */}
        <button
          onClick={() => {
            playSound.tap();
            setShowCustomModal(true);
          }}
          aria-label="Add custom unbarcoded item"
          className="touch-btn flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-2xl shadow-sm border border-brand-500 shrink-0"
        >
          <Sparkles className="w-4 h-4 fill-white/20" />
          <span>+ Custom Item</span>
        </button>
      </div>

      {/* Category Pills (Touch scrollable) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Product categories">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            role="tab"
            aria-selected={selectedCategory === cat.id}
            onClick={() => {
              playSound.tap();
              setSelectedCategory(cat.id);
            }}
            className={`touch-btn flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border ${
              selectedCategory === cat.id
                ? 'bg-slate-900 text-brand-300 border-slate-900 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span className="text-sm">{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Product Grid Area */}
      <div className="flex-1 overflow-y-auto pr-1">
        {filteredProducts.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400">
            <Package className="w-12 h-12 stroke-[1.5] text-slate-300 mb-2" />
            <p className="font-bold text-slate-700 text-base">No items found</p>
            <p className="text-xs text-slate-500 mt-1">
              {searchQuery
                ? `No products matching "${searchQuery}"`
                : 'No products in this category yet.'}
            </p>
            <button
              onClick={() => {
                playSound.tap();
                setShowCustomModal(true);
              }}
              className="mt-4 px-4 py-2 bg-brand-50 text-brand-700 border border-brand-200 rounded-xl text-xs font-bold hover:bg-brand-100 transition"
            >
              Add as Custom Item instead
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {filteredProducts.map((product) => {
              const isOutOfStock = product.stock_qty <= 0;
              const isLowStock =
                !isOutOfStock && product.stock_qty <= product.low_stock_threshold;

              return (
                <button
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  aria-label={`Add ${product.name} to cart, ${formatPeso(product.selling_price)}`}
                  className={`touch-btn text-left p-3 rounded-2xl bg-white border border-slate-200 hover:border-brand-400 hover:shadow-card-hover transition-all flex flex-col justify-between relative group ${
                    isOutOfStock ? 'opacity-60 bg-slate-50' : ''
                  }`}
                >
                  {/* Top: Category Tag & Bottle Deposit Tag */}
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[10px] font-semibold text-slate-500 truncate uppercase tracking-wider">
                        {product.category}
                      </span>
                      {product.has_bottle_deposit && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded">
                          +₱{product.bottle_deposit_fee} dep
                        </span>
                      )}
                    </div>

                    {/* Product Name */}
                    <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
                      {product.name}
                    </h3>
                  </div>

                  {/* Bottom: Stock Status & Price */}
                  <div className="pt-2 mt-2 border-t border-slate-100 flex items-end justify-between">
                    <div>
                      {/* Stock Indicator */}
                      <div className="flex items-center gap-1 text-[11px] mb-0.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isOutOfStock
                              ? 'bg-red-500'
                              : isLowStock
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                        <span
                          className={`font-semibold ${
                            isOutOfStock
                              ? 'text-red-600 font-bold'
                              : isLowStock
                              ? 'text-amber-600 font-bold'
                              : 'text-slate-500'
                          }`}
                        >
                          {isOutOfStock
                            ? 'Out of stock'
                            : `${product.stock_qty} ${product.unit_label || 'pcs'}`}
                        </span>
                      </div>

                      {/* Selling Price */}
                      <div className="text-base font-black text-brand-600 leading-none">
                        {formatPeso(product.selling_price)}
                      </div>
                    </div>

                    {/* Quick Add Icon Button */}
                    <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-brand-600 group-hover:text-white text-slate-700 flex items-center justify-center transition-colors shadow-sm shrink-0">
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom Tingi Modal */}
      <CustomTingiModal
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onAdd={(name, sellingPrice, costPrice) => {
          addCustomCartItem(name, sellingPrice, costPrice);
          playSound.tap();
        }}
      />

      {/* Camera Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
      />
    </div>
  );
};
