import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { CategoryIcon, POPULAR_CATEGORY_SUGGESTIONS } from '../../utils/categoryIcons';
import { playSound } from '../../utils/audio';
import {
  X,
  Plus,
  Trash2,
  Tag,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles,
} from 'lucide-react';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCategory?: (category: string) => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  onSelectCategory,
}) => {
  const { categories, products, addCategory, deleteCategory } = useStore();

  const [newCatName, setNewCatName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Category deletion confirmation state
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleAddCategory = async (nameToAdd?: string) => {
    const targetName = (nameToAdd || newCatName).trim();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!targetName) {
      setErrorMsg('Please enter a category name.');
      playSound.warning();
      return;
    }

    setIsSubmitting(true);
    const res = await addCategory(targetName);
    setIsSubmitting(false);

    if (res.success) {
      playSound.success();
      setSuccessMsg(`Category "${targetName}" added successfully!`);
      setNewCatName('');
      if (onSelectCategory) {
        onSelectCategory(targetName);
      }
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      playSound.warning();
      setErrorMsg(res.error || 'Failed to add category');
    }
  };

  const handleDeleteCategory = async (categoryName: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsDeleting(true);

    const res = await deleteCategory(categoryName);
    setIsDeleting(false);
    setCategoryToDelete(null);

    if (res.success) {
      playSound.tap();
      const affectedNote =
        res.affectedCount && res.affectedCount > 0
          ? ` (${res.affectedCount} product${res.affectedCount > 1 ? 's were' : ' was'} moved to "Other")`
          : '';
      setSuccessMsg(`Category "${categoryName}" deleted${affectedNote}.`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } else {
      playSound.warning();
      setErrorMsg(res.error || 'Failed to delete category');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-modal-title"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 id="category-modal-title" className="text-base font-bold tracking-tight">
                Product Categories
              </h2>
              <p className="text-xs text-slate-400">
                Add custom categories or delete unused ones
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              playSound.tap();
              onClose();
            }}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Notifications */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-rose-700">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Add Category Section */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
            <label
              htmlFor="new-category-input"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-brand-600 stroke-[3]" />
              <span>Add New Category</span>
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddCategory();
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <input
                  id="new-category-input"
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Frozen Foods, Bigas / Rice, Bakery"
                  maxLength={40}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-inner"
                />
                {newCatName.trim() && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                    <CategoryIcon category={newCatName.trim()} className="w-5 h-5" />
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={isSubmitting || !newCatName.trim()}
                className="touch-btn px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Add</span>
              </button>
            </form>

            {/* Quick Sari-Sari Store Category Suggestions */}
            <div className="mt-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Popular Store Suggestions:</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_CATEGORY_SUGGESTIONS.filter(
                  (sug) =>
                    !categories.some(
                      (c) => c.toLowerCase() === sug.name.toLowerCase()
                    )
                ).map((sug) => (
                  <button
                    key={sug.name}
                    type="button"
                    onClick={() => {
                      playSound.tap();
                      setNewCatName(sug.name);
                    }}
                    className="touch-btn px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition flex items-center gap-1.5 shadow-2xs"
                  >
                    <CategoryIcon category={sug.name} className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{sug.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Current Categories List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>Existing Categories ({categories.length})</span>
              </span>
              <span className="text-[11px] text-slate-400">
                Products in deleted categories move to "Other"
              </span>
            </div>

            <div className="space-y-1.5">
              {categories.map((cat) => {
                const isOther = cat.toLowerCase() === 'other';
                const count = products.filter(
                  (p) => p.category?.toLowerCase() === cat.toLowerCase()
                ).length;
                const isConfirming = categoryToDelete === cat;

                return (
                  <div
                    key={cat}
                    className={`p-3 rounded-2xl border transition-all ${
                      isConfirming
                        ? 'bg-rose-50 border-rose-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {isConfirming ? (
                      // Confirmation Prompt
                      <div className="space-y-2.5 animate-fade-in">
                        <div className="flex items-start gap-2 text-rose-800 text-xs font-bold">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                          <div>
                            <p>Are you sure you want to delete "{cat}"?</p>
                            {count > 0 ? (
                              <p className="text-[11px] font-normal text-rose-700 mt-0.5">
                                {count} existing product{count > 1 ? 's' : ''} in this category will be safely reassigned to <strong>"Other"</strong>.
                              </p>
                            ) : (
                              <p className="text-[11px] font-normal text-rose-600 mt-0.5">
                                No products are currently assigned to this category.
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              playSound.tap();
                              setCategoryToDelete(null);
                            }}
                            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleDeleteCategory(cat)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Confirm Delete</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Normal Item Row
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 border border-slate-200/60">
                            <CategoryIcon category={cat} className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 text-sm block truncate">
                              {cat}
                            </span>
                            <span className="text-[11px] font-medium text-slate-400">
                              {count} {count === 1 ? 'item' : 'items'} in inventory
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isOther ? (
                            <span
                              title="Default fallback category, protected from deletion"
                              className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[11px] font-bold flex items-center gap-1 border border-slate-200"
                            >
                              <Lock className="w-3 h-3 text-slate-400" />
                              <span>Default</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                playSound.tap();
                                setCategoryToDelete(cat);
                              }}
                              className="touch-btn p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                              title={`Delete ${cat} category`}
                              aria-label={`Delete ${cat} category`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              playSound.tap();
              onClose();
            }}
            className="touch-btn px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
