import React, { useState } from 'react';
import { X, Plus, Sparkles, Tag } from 'lucide-react';
import { formatPeso } from '../../utils/formatters';
import { playSound } from '../../utils/audio';

interface CustomTingiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, sellingPrice: number, costPrice?: number) => void;
}

const PRESET_PRICES = [5, 10, 15, 20, 25, 50];

export const CustomTingiModal: React.FC<CustomTingiModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(sellingPrice);
    const cost = parseFloat(costPrice) || 0;

    if (!name.trim()) {
      setError('Please provide an item description or name (e.g. Repacked Garlic)');
      playSound.warning();
      return;
    }
    if (isNaN(price) || price <= 0) {
      setError('Please enter a valid selling price greater than ₱0');
      playSound.warning();
      return;
    }

    onAdd(name.trim(), price, cost);
    setName('');
    setSellingPrice('');
    setCostPrice('');
    setError(null);
    onClose();
  };

  const handlePresetClick = (val: number) => {
    playSound.tap();
    setSellingPrice(val.toString());
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Custom Manual Item</h2>
              <p className="text-xs text-slate-500">Add unbarcoded or repacked item to cart</p>
            </div>
          </div>
          <button
            onClick={() => {
              playSound.tap();
              onClose();
            }}
            aria-label="Close modal"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="py-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="custom-item-name" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Item Name / Description
            </label>
            <input
              id="custom-item-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Repacked Garlic, Ice Water, Fried Banana"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              autoFocus
              required
            />
          </div>

          <div>
            <label htmlFor="custom-selling-price" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Selling Price
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-500 font-black text-lg">₱</span>
              <input
                id="custom-selling-price"
                type="number"
                step="0.25"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-3.5 py-2.5 border border-slate-300 rounded-xl font-black text-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>

            {/* Quick Price Presets */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PRESET_PRICES.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handlePresetClick(amt)}
                  className="touch-btn px-2.5 py-1 bg-slate-100 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 transition"
                >
                  ₱{amt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="custom-cost-price" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Estimated Cost Price (Optional)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 font-bold">₱</span>
              <input
                id="custom-cost-price"
                type="number"
                step="0.25"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Used to calculate net profit in the daily sales report.
            </p>
          </div>

          <div className="pt-3 border-t flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                playSound.tap();
                onClose();
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-black text-sm shadow-md"
            >
              Add to Cart
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
