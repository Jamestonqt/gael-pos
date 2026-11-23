import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { formatPeso } from '../../utils/formatters';
import {
  Trash2,
  Plus,
  Minus,
  Banknote,
  Smartphone,
  BookOpen,
  Wine,
  AlertTriangle,
  Search,
  X,
  CreditCard,
  ShoppingBag,
  Percent,
  Camera,
} from 'lucide-react';
import { ReceiptModal } from './ReceiptModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { Sale, UtangCustomer } from '../../types';
import { playSound } from '../../utils/audio';

const PESO_DENOMINATIONS = [20, 50, 100, 200, 500, 1000];

export const CartPanel: React.FC = () => {
  const {
    cart,
    removeFromCart,
    updateCartQuantity,
    toggleCartBottleDeposit,
    clearCart,
    cartSubtotal,
    cartBottleDepositTotal,
    cartTotalAmount,
    checkout,
    customers,
  } = useStore();

  const [cashTendered, setCashTendered] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<string>('0');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showUtangModal, setShowUtangModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);

  const numericCashTendered = parseFloat(cashTendered) || 0;
  const numericDiscount = parseFloat(discountAmount) || 0;
  const finalTotalAmount = Math.max(0, cartTotalAmount - numericDiscount);

  // Realtime change calculation
  const changeDue = numericCashTendered - finalTotalAmount;
  const hasSufficientCash = numericCashTendered >= finalTotalAmount;

  // Filter customers for Credit modal
  const filteredCustomers = customers.filter(
    (c) =>
      c.full_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.nickname.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.contact_number.includes(customerSearch)
  );

  const handleQuickCash = (amount: number) => {
    playSound.tap();
    setCashTendered(amount.toString());
  };

  const handleExactCash = () => {
    playSound.tap();
    setCashTendered(finalTotalAmount.toFixed(2));
  };

  const handleCheckoutCash = async () => {
    setCheckoutError(null);
    if (cart.length === 0) return;

    if (!hasSufficientCash && numericCashTendered !== 0) {
      playSound.warning();
      setCheckoutError(
        `Insufficient payment! Tendered: ${formatPeso(numericCashTendered)}, Total: ${formatPeso(finalTotalAmount)}`
      );
      return;
    }

    const tendered = numericCashTendered > 0 ? numericCashTendered : finalTotalAmount;

    setIsProcessing(true);
    const result = await checkout({
      paymentMethod: 'Cash',
      cashTendered: tendered,
      discountAmount: numericDiscount,
    });
    setIsProcessing(false);

    if (result.success && result.sale) {
      playSound.success();
      setCompletedSale(result.sale);
      setCashTendered('');
      setDiscountAmount('0');
    } else {
      playSound.warning();
      setCheckoutError(result.error || 'Checkout failed');
    }
  };

  const handleCheckoutDigital = async (method: 'GCash' | 'Maya') => {
    setCheckoutError(null);
    if (cart.length === 0) return;

    setIsProcessing(true);
    const result = await checkout({
      paymentMethod: method,
      cashTendered: finalTotalAmount,
      discountAmount: numericDiscount,
    });
    setIsProcessing(false);

    if (result.success && result.sale) {
      playSound.success();
      setCompletedSale(result.sale);
      setCashTendered('');
      setDiscountAmount('0');
    } else {
      playSound.warning();
      setCheckoutError(result.error || 'Checkout failed');
    }
  };

  const handleOpenUtangModal = () => {
    if (cart.length === 0) return;
    playSound.tap();
    setCheckoutError(null);
    setShowUtangModal(true);
  };

  const handleConfirmUtangCheckout = async (customer: UtangCustomer) => {
    setCheckoutError(null);
    const balanceAfter = customer.current_balance + finalTotalAmount;
    if (balanceAfter > customer.credit_limit) {
      playSound.warning();
      setCheckoutError(
        `Cannot charge: Exceeds customer credit limit (${formatPeso(customer.credit_limit)}). Balance after purchase: ${formatPeso(balanceAfter)}`
      );
      return;
    }

    setIsProcessing(true);
    const result = await checkout({
      paymentMethod: 'Utang',
      cashTendered: 0,
      utangCustomerId: customer.id,
      discountAmount: numericDiscount,
    });
    setIsProcessing(false);

    if (result.success && result.sale) {
      playSound.success();
      setShowUtangModal(false);
      setSelectedCustomerId(null);
      setCompletedSale(result.sale);
      setCashTendered('');
      setDiscountAmount('0');
    } else {
      playSound.warning();
      setCheckoutError(result.error || 'Credit checkout failed');
    }
  };

  return (
    <>
      <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Cart Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <span className="font-black text-slate-900 text-base">Shopping Cart</span>
            <span className="px-2 py-0.5 bg-brand-100 text-brand-800 font-bold text-xs rounded-full">
              {cart.reduce((sum, i) => sum + i.quantity, 0)} items
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                playSound.tap();
                setShowScannerModal(true);
              }}
              aria-label="Scan item barcode with camera"
              className="touch-btn flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow-sm border border-slate-700 transition"
              title="Open Camera Barcode Scanner"
            >
              <Camera className="w-3.5 h-3.5 text-brand-400" />
              <span>Scan</span>
            </button>
            {cart.length > 0 && (
              <button
                onClick={() => {
                  playSound.tap();
                  clearCart();
                }}
                aria-label="Clear all items from shopping cart"
                className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center text-slate-400 p-4">
              <ShoppingBag className="w-10 h-10 text-slate-300 stroke-[1.5] mb-2" />
              <p className="font-bold text-slate-700 text-sm">Your cart is empty</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Select items from the catalog or add a custom item.
              </p>
            </div>
          ) : (
            cart.map((item) => {
              const unitPrice = item.custom_price ?? item.product.selling_price;
              const itemTotal =
                unitPrice * item.quantity +
                (item.include_bottle_deposit
                  ? (item.bottle_deposit_amount || 10) * item.quantity
                  : 0);

              return (
                <div
                  key={item.product.id}
                  className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-2"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                        {item.product.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {formatPeso(unitPrice)} per {item.product.unit_label || 'pc'}
                      </div>
                    </div>
                    <div className="font-black text-sm text-slate-900 shrink-0">
                      {formatPeso(itemTotal)}
                    </div>
                  </div>

                  {/* Bottle Deposit Toggle (if applicable) */}
                  {item.product.has_bottle_deposit && (
                    <button
                      type="button"
                      onClick={() => {
                        playSound.tap();
                        toggleCartBottleDeposit(item.product.id);
                      }}
                      className={`touch-btn w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition border ${
                        item.include_bottle_deposit
                          ? 'bg-amber-50 border-amber-300 text-amber-900'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Wine className="w-3.5 h-3.5 text-amber-600" />
                        <span>Include Bottle Deposit (+₱10)</span>
                      </span>
                      <span className="font-black">
                        {item.include_bottle_deposit ? 'YES' : 'NO'}
                      </span>
                    </button>
                  )}

                  {/* Quantity and Remove Controls */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          playSound.tap();
                          updateCartQuantity(item.product.id, item.quantity - 1);
                        }}
                        className="touch-btn w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold"
                        aria-label={`Decrease quantity of ${item.product.name}`}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-9 text-center font-black text-sm text-slate-800">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => {
                          playSound.tap();
                          updateCartQuantity(item.product.id, item.quantity + 1);
                        }}
                        className="touch-btn w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold"
                        aria-label={`Increase quantity of ${item.product.name}`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        playSound.tap();
                        removeFromCart(item.product.id);
                      }}
                      className="touch-btn p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      aria-label={`Remove ${item.product.name} from cart`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Totals & Change Calculator */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 space-y-3">
          {/* Subtotal & Deposit summary */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-bold text-slate-900">{formatPeso(cartSubtotal)}</span>
            </div>
            {cartBottleDepositTotal > 0 && (
              <div className="flex justify-between text-amber-800 font-bold">
                <span>Bottle Deposit:</span>
                <span>+{formatPeso(cartBottleDepositTotal)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-1 border-t border-slate-200">
              <span className="font-bold text-slate-900 text-sm">TOTAL DUE:</span>
              <span className="font-black text-2xl text-slate-950">
                {formatPeso(finalTotalAmount)}
              </span>
            </div>
          </div>

          {/* Instant Change Calculator */}
          <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <label htmlFor="cash-tendered-input">Cash Tendered:</label>
              <button
                type="button"
                onClick={handleExactCash}
                disabled={cart.length === 0}
                className="text-[11px] font-bold text-brand-600 hover:text-brand-700 underline disabled:opacity-50"
              >
                Exact Amount
              </button>
            </div>

            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-500 font-black text-base">₱</span>
              <input
                id="cash-tendered-input"
                type="number"
                step="0.50"
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
                placeholder={finalTotalAmount > 0 ? finalTotalAmount.toFixed(2) : '0.00'}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg font-black text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Quick Peso Denominations Buttons */}
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
              <button
                type="button"
                onClick={handleExactCash}
                className="touch-btn py-1 px-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] text-center"
              >
                Exact
              </button>
              {PESO_DENOMINATIONS.map((den) => (
                <button
                  key={den}
                  type="button"
                  onClick={() => handleQuickCash(den)}
                  className="touch-btn py-1 px-1 rounded bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-900 font-bold text-[11px] text-center"
                >
                  ₱{den}
                </button>
              ))}
            </div>

            {/* Live Change / Shortage Display */}
            {numericCashTendered > 0 && (
              <div
                className={`p-2 rounded-lg text-center font-black text-xs sm:text-sm flex items-center justify-center gap-2 ${
                  hasSufficientCash
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'bg-red-100 text-red-900 border border-red-300'
                }`}
              >
                <span>{hasSufficientCash ? 'CHANGE DUE:' : 'INSUFFICIENT (SHORT):'}</span>
                <span className="text-base">{formatPeso(Math.abs(changeDue))}</span>
              </div>
            )}
          </div>

          {/* Checkout Error Message */}
          {checkoutError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{checkoutError}</span>
            </div>
          )}

          {/* Three Checkout Payment Buttons */}
          <div className="space-y-1.5 pt-1">
            {/* Cash Button */}
            <button
              onClick={handleCheckoutCash}
              disabled={cart.length === 0 || isProcessing}
              className="touch-btn w-full flex items-center justify-between px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-md transition"
            >
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5" />
                <span>Pay with CASH</span>
              </div>
              <span>{formatPeso(finalTotalAmount)}</span>
            </button>

            {/* GCash / Maya Button */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => handleCheckoutDigital('GCash')}
                disabled={cart.length === 0 || isProcessing}
                className="touch-btn flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition"
              >
                <Smartphone className="w-4 h-4" />
                <span>GCash Pay</span>
              </button>

              <button
                onClick={() => handleCheckoutDigital('Maya')}
                disabled={cart.length === 0 || isProcessing}
                className="touch-btn flex items-center justify-center gap-1.5 py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition"
              >
                <CreditCard className="w-4 h-4" />
                <span>Maya Pay</span>
              </button>
            </div>

            {/* Utang / Customer Credit Button */}
            <button
              onClick={handleOpenUtangModal}
              disabled={cart.length === 0 || isProcessing}
              className="touch-btn w-full flex items-center justify-center gap-2 py-2.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-md border border-brand-600 transition"
            >
              <BookOpen className="w-4 h-4" />
              <span>Charge to Customer Credit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Credit Customer Selection Modal */}
      {showUtangModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-brand-600" />
                  Select Customer for Store Credit
                </h3>
                <p className="text-xs text-slate-500">
                  Total amount to charge: <strong className="text-slate-900">{formatPeso(finalTotalAmount)}</strong>
                </p>
              </div>
              <button
                onClick={() => {
                  playSound.tap();
                  setShowUtangModal(false);
                }}
                aria-label="Close modal"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Search */}
            <div className="py-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search by name, nickname, or phone..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Customer List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No registered credit customers found matching "{customerSearch}".
                </div>
              ) : (
                filteredCustomers.map((cust) => {
                  const newBalance = cust.current_balance + finalTotalAmount;
                  const willExceed = newBalance > cust.credit_limit;
                  const isBlocked = cust.is_blocked;

                  return (
                    <button
                      key={cust.id}
                      onClick={() => handleConfirmUtangCheckout(cust)}
                      disabled={isBlocked || willExceed}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                        isBlocked || willExceed
                          ? 'opacity-50 bg-slate-50 border-slate-200 cursor-not-allowed'
                          : 'bg-white border-slate-200 hover:border-brand-500 hover:bg-brand-50/50'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                          <span>{cust.full_name}</span>
                          {cust.nickname && (
                            <span className="text-xs font-normal text-slate-500">
                              ({cust.nickname})
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {cust.contact_number || 'No contact #'}
                        </div>
                        {willExceed && !isBlocked && (
                          <div className="text-[10px] font-bold text-red-600 mt-0.5">
                            Exceeds limit ({formatPeso(newBalance)} / {formatPeso(cust.credit_limit)})
                          </div>
                        )}
                        {isBlocked && (
                          <div className="text-[10px] font-bold text-red-600 mt-0.5">
                            Account Blocked
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-[11px] text-slate-500">Current Balance:</div>
                        <div className="font-black text-sm text-slate-900">
                          {formatPeso(cust.current_balance)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Limit: {formatPeso(cust.credit_limit)}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t flex justify-end">
              <button
                type="button"
                onClick={() => setShowUtangModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Sale Receipt Modal */}
      <ReceiptModal
        sale={completedSale}
        onClose={() => setCompletedSale(null)}
      />

      {/* Camera Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
      />
    </>
  );
};
