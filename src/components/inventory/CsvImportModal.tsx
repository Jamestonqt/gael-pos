import React, { useState } from 'react';
import { ParsedCsvResult } from '../../utils/csvInventory';
import { CategoryIcon } from '../../utils/categoryIcons';
import { formatPeso } from '../../utils/formatters';
import { playSound } from '../../utils/audio';
import {
  X,
  FileSpreadsheet,
  AlertTriangle,
  RefreshCw,
  Layers,
  CheckCircle2,
  Package,
  Barcode,
} from 'lucide-react';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  parsedData: ParsedCsvResult | null;
  onConfirm: (mode: 'merge' | 'replace') => Promise<void>;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  parsedData,
  onConfirm,
}) => {
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !parsedData) return null;

  const { items, categories, fileName, totalRows, invalidRows } = parsedData;

  const handleConfirm = async () => {
    playSound.tap();
    setIsSubmitting(true);
    try {
      await onConfirm(importMode);
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewItems = items.slice(0, 6);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="csv-modal-title"
    >
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 id="csv-modal-title" className="font-black text-slate-900 text-lg">
                Restore & Import Inventory
              </h2>
              <p className="text-xs text-slate-500 font-medium truncate max-w-xs sm:max-w-md">
                File: <span className="font-semibold text-slate-800">{fileName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              playSound.tap();
              onClose();
            }}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto space-y-4 pr-1">
          {/* Quick Summary Pill */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-600" />
              <span className="text-xs font-bold text-slate-900">
                Found <span className="font-mono text-brand-700">{items.length}</span> items across{' '}
                <span className="font-mono text-brand-700">{categories.length}</span> categories
              </span>
            </div>
            {invalidRows > 0 && (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                {invalidRows} empty/invalid rows skipped
              </span>
            )}
          </div>

          {/* Categories Detected */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Categories to sync ({categories.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {categories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs"
                >
                  <CategoryIcon category={cat} className="w-3.5 h-3.5 text-slate-500" />
                  <span>{cat}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Import Mode Selector */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Select Restore / Merge Option:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option A: Merge */}
              <button
                type="button"
                onClick={() => {
                  playSound.tap();
                  setImportMode('merge');
                }}
                className={`touch-btn text-left p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                  importMode === 'merge'
                    ? 'bg-brand-50/70 border-brand-500 ring-2 ring-brand-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-brand-600" />
                    <span className="font-black text-sm text-slate-900">
                      Merge / Update Existing
                    </span>
                  </div>
                  {importMode === 'merge' && (
                    <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mt-1">
                  Updates matching items by barcode or name and adds new items. Existing store items not
                  in this file are safely preserved.
                </p>
                <span className="mt-2 text-[11px] font-bold text-brand-700 uppercase tracking-wider">
                  Recommended for updates
                </span>
              </button>

              {/* Option B: Replace All */}
              <button
                type="button"
                onClick={() => {
                  playSound.tap();
                  setImportMode('replace');
                }}
                className={`touch-btn text-left p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                  importMode === 'replace'
                    ? 'bg-rose-50/70 border-rose-500 ring-2 ring-rose-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span className="font-black text-sm text-rose-950">Replace All Inventory</span>
                  </div>
                  {importMode === 'replace' && (
                    <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mt-1">
                  Clears current inventory and restores the exact list from this spreadsheet. Ideal
                  when restoring from an accidental wipe.
                </p>
                <span className="mt-2 text-[11px] font-bold text-rose-700 uppercase tracking-wider">
                  Full backup restoration
                </span>
              </button>
            </div>
          </div>

          {/* Preview Table */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Sample Preview (First {previewItems.length} of {items.length} items)
              </span>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Product Name</th>
                    <th className="py-2 px-2">Category</th>
                    <th className="py-2 px-2 text-right">Cost</th>
                    <th className="py-2 px-2 text-right">Price</th>
                    <th className="py-2 px-2 text-center">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-900 truncate max-w-[140px]">
                        {item.name}
                        {item.barcode && (
                          <span className="block text-[11px] text-slate-500 font-mono">
                            {item.barcode}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700">
                          <CategoryIcon category={item.category} className="w-3 h-3 text-slate-500" />
                          <span>{item.category}</span>
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-600">
                        {formatPeso(item.cost)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                        {formatPeso(item.price)}
                      </td>
                      <td className="py-2 px-2 text-center font-mono font-bold text-slate-800">
                        {item.stock} {item.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => {
              playSound.tap();
              onClose();
            }}
            disabled={isSubmitting}
            className="touch-btn px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={`touch-btn px-5 py-2.5 rounded-xl text-white font-black text-sm shadow-sm transition flex items-center gap-2 ${
              importMode === 'replace'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-brand-600 hover:bg-brand-700'
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving to IndexedDB & Supabase...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {importMode === 'replace' ? 'Replace All Inventory' : 'Merge & Update Inventory'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
