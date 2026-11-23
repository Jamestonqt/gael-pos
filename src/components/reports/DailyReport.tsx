import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Sale } from '../../types';
import { formatPeso, formatDateTime } from '../../utils/formatters';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Smartphone,
  BookOpen,
  Printer,
  ShieldAlert,
  KeyRound,
  X,
  AlertTriangle,
  RotateCcw,
  Award,
  CreditCard,
  Banknote,
  Receipt,
} from 'lucide-react';
import { ReceiptModal } from '../pos/ReceiptModal';

export const DailyReport: React.FC = () => {
  const { sales, walletLogs, transactions, customers, settings, voidSale } = useStore();

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // Void modal state
  const [voidTargetSale, setVoidTargetSale] = useState<Sale | null>(null);
  const [ownerPinInput, setOwnerPinInput] = useState<string>('');
  const [voidError, setVoidError] = useState<string | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);

  // View receipt modal state
  const [viewReceiptSale, setViewReceiptSale] = useState<Sale | null>(null);

  // Filter records by selected date
  const daySales = useMemo(() => {
    return sales.filter((s) => s.created_at.slice(0, 10) === selectedDate);
  }, [sales, selectedDate]);

  const completedSales = useMemo(() => {
    return daySales.filter((s) => s.status === 'Completed');
  }, [daySales]);

  const dayWalletLogs = useMemo(() => {
    return walletLogs.filter((w) => w.created_at.slice(0, 10) === selectedDate);
  }, [walletLogs, selectedDate]);

  const dayTransactions = useMemo(() => {
    return transactions.filter((t) => t.created_at.slice(0, 10) === selectedDate);
  }, [transactions, selectedDate]);

  // 1. Gross Sales (Today's completed sales)
  const grossSales = completedSales.reduce((sum, s) => sum + s.total_amount, 0);

  // 2. Net Profit: completed sales net profit + wallet fees earned
  const salesNetProfit = completedSales.reduce((sum, s) => sum + s.net_profit, 0);
  const walletFeesEarned = dayWalletLogs.reduce((sum, w) => sum + w.fee_earned, 0);
  const totalNetProfit = salesNetProfit + walletFeesEarned;

  // 3. Total Cash Collected:
  // Cash sales + Utang payments in Cash + Cash drawer delta from wallet logs
  const cashSalesTotal = completedSales
    .filter((s) => s.payment_method === 'Cash')
    .reduce((sum, s) => sum + s.total_amount, 0);

  const utangCashPayments = dayTransactions
    .filter((t) => t.entry_type === 'payment' && t.payment_channel === 'Cash')
    .reduce((sum, t) => sum + t.amount, 0);

  const walletCashCollected = dayWalletLogs
    .filter((w) => w.cash_drawer_delta > 0)
    .reduce((sum, w) => sum + w.cash_drawer_delta, 0);

  const totalCashCollected = cashSalesTotal + utangCashPayments + walletCashCollected;

  // 4. Total GCash/Maya Sales
  const gcashMayaSales = completedSales
    .filter((s) => s.payment_method === 'GCash' || s.payment_method === 'Maya')
    .reduce((sum, s) => sum + s.total_amount, 0);

  // 5. New Credit Issued
  const newUtangIssued = completedSales
    .filter((s) => s.payment_method === 'Utang')
    .reduce((sum, s) => sum + s.total_amount, 0);

  // Top Selling Products Calculation
  const topSellingProducts = useMemo(() => {
    const itemMap = new Map<
      string,
      { name: string; category: string; quantity: number; revenue: number; profit: number }
    >();

    for (const sale of completedSales) {
      for (const item of sale.items) {
        const key = item.name;
        const existing = itemMap.get(key) || {
          name: item.name,
          category: item.category,
          quantity: 0,
          revenue: 0,
          profit: 0,
        };
        existing.quantity += item.quantity;
        existing.revenue += item.subtotal;
        existing.profit += item.subtotal - item.cost_price * item.quantity;
        itemMap.set(key, existing);
      }
    }

    return Array.from(itemMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [completedSales]);

  // Handle Void
  const handleOpenVoid = (sale: Sale) => {
    setVoidTargetSale(sale);
    setOwnerPinInput('');
    setVoidError(null);
  };

  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidTargetSale) return;

    if (!ownerPinInput.trim()) {
      setVoidError('Please enter the Owner PIN to authorize voiding.');
      return;
    }

    setIsVoiding(true);
    const res = await voidSale(voidTargetSale.id, ownerPinInput.trim());
    setIsVoiding(false);

    if (res.success) {
      setVoidTargetSale(null);
    } else {
      setVoidError(res.error || 'Failed to void sale');
    }
  };

  const handlePrintZReading = () => {
    window.print();
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Top Banner with Date Selector & Print Button */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-brand-600" />
            Daily Z-Reading & Profit Report
          </h2>
          <p className="text-xs text-slate-500">
            End-of-day reconciliation, cash breakdown, and sales performance
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Date Picker */}
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-3 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <button
            onClick={handlePrintZReading}
            className="touch-btn flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* 6 Core Z-Reading Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {/* 1. Gross Sales */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              1. Gross Sales
            </span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-950">
            {formatPeso(grossSales)}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            {completedSales.length} completed transactions
          </p>
        </div>

        {/* 2. Net Profit */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              2. Net Profit (Earnings)
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700">
            {formatPeso(totalNetProfit)}
          </div>
          <p className="text-[11px] text-emerald-800 font-medium">
            Products: {formatPeso(salesNetProfit)} + Services: {formatPeso(walletFeesEarned)}
          </p>
        </div>

        {/* 3. Total Cash Collected */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              3. Total Cash Collected
            </span>
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-950">
            {formatPeso(totalCashCollected)}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Cash sales + Credit payments + Load cash
          </p>
        </div>

        {/* 4. Total GCash/Maya Sales */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              4. GCash & Maya Sales
            </span>
            <CreditCard className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-700">
            {formatPeso(gcashMayaSales)}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Digital payments credited to wallet
          </p>
        </div>

        {/* 5. E-Load & GCash Fees Earned */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              5. E-Load & GCash Fees Earned
            </span>
            <Smartphone className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-700">
            +{formatPeso(walletFeesEarned)}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            {dayWalletLogs.length} wallet transactions today
          </p>
        </div>

        {/* 6. New Store Credit Issued */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              6. New Store Credit Issued (Utang)
            </span>
            <BookOpen className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-700">
            {formatPeso(newUtangIssued)}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Credit extended to registered customers
          </p>
        </div>
      </div>

      {/* Top Selling Products & Cash Drawer Reconciliation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Top Selling Products List */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <h3 className="font-black text-base text-slate-900">
                Top-Selling Products Today
              </h3>
            </div>
            <span className="text-xs font-bold text-slate-500">Ranked by volume</span>
          </div>

          <div className="space-y-2">
            {topSellingProducts.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-400">
                No completed sales recorded for this date.
              </p>
            ) : (
              topSellingProducts.map((item, index) => (
                <div
                  key={item.name}
                  className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                        index === 0
                          ? 'bg-amber-400 text-slate-950 shadow-sm'
                          : index === 1
                          ? 'bg-slate-300 text-slate-900'
                          : index === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      #{index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                        {item.name}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {item.category} • Sales: {formatPeso(item.revenue)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-black text-sm text-slate-950">
                      {item.quantity} pcs
                    </div>
                    <div className="text-[10px] font-bold text-emerald-700">
                      +{formatPeso(item.profit)} profit
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Store Wallets & Cash Drawer Status */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b">
            <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-emerald-600" />
              Cash Drawer & Wallets Summary
            </h3>
            <span className="text-xs font-bold text-slate-500">Live Balances</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">Cash Drawer Balance (Physical Cash)</div>
                <div className="text-[11px] text-slate-500">Cash bills and coins currently in the till</div>
              </div>
              <div className="text-lg font-black text-emerald-700">
                {formatPeso(settings.cash_drawer_balance)}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">GCash / Maya Digital Wallet</div>
                <div className="text-[11px] text-slate-500">Digital wallet fund balance</div>
              </div>
              <div className="text-lg font-black text-blue-700">
                {formatPeso(settings.gcash_wallet_balance)}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">Load Wallet (Retailer SIM)</div>
                <div className="text-[11px] text-slate-500">Prepaid e-load inventory balance</div>
              </div>
              <div className="text-lg font-black text-amber-700">
                {formatPeso(settings.load_wallet_balance)}
              </div>
            </div>

            <div className="pt-2 text-[11px] text-slate-500 text-center">
              * To adjust or reset starting drawer balances, click the Settings icon (⚙️) in the top bar.
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions Table with Void / Refund Option */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b">
          <div>
            <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-slate-600" />
              Recent Sales Transactions
            </h3>
            <p className="text-xs text-slate-500">
              Receipt records for the selected date with PIN-protected void capability
            </p>
          </div>
          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-full">
            {daySales.length} receipts
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Receipt #</th>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Payment</th>
                <th className="py-2.5 px-3">Items</th>
                <th className="py-2.5 px-3 text-right">Total Amount</th>
                <th className="py-2.5 px-3 text-right">Profit</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {daySales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No transactions recorded for the selected date.
                  </td>
                </tr>
              ) : (
                daySales.map((sale) => {
                  const isVoided = sale.status === 'Voided';
                  const utangCust = sale.utang_customer_id
                    ? customers.find((c) => c.id === sale.utang_customer_id)
                    : null;

                  return (
                    <tr
                      key={sale.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isVoided ? 'opacity-60 bg-red-50/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {sale.receipt_no}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {formatDateTime(sale.created_at)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                            sale.payment_method === 'Cash'
                              ? 'bg-emerald-100 text-emerald-900'
                              : sale.payment_method === 'GCash'
                              ? 'bg-blue-100 text-blue-900'
                              : sale.payment_method === 'Maya'
                              ? 'bg-emerald-900 text-emerald-100'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {sale.payment_method}
                        </span>
                        {utangCust && (
                          <div className="text-[10px] text-slate-600 font-semibold truncate mt-0.5">
                            {utangCust.full_name}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate">
                        {sale.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-950">
                        {formatPeso(sale.total_amount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                        {isVoided ? '₱0.00' : formatPeso(sale.net_profit)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            isVoided
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {sale.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View Receipt */}
                          <button
                            onClick={() => setViewReceiptSale(sale)}
                            className="touch-btn px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px]"
                            title="View Receipt"
                          >
                            Receipt
                          </button>

                          {/* Void Sale (only if not voided) */}
                          {!isVoided && (
                            <button
                              onClick={() => handleOpenVoid(sale)}
                              className="touch-btn px-2 py-1 rounded bg-red-100 hover:bg-red-200 text-red-800 font-black text-[11px] flex items-center gap-1"
                              title="Void Sale (Owner PIN Required)"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Void</span>
                            </button>
                          )}
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

      {/* Owner PIN Protected Void Confirmation Modal */}
      {voidTargetSale && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-200">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2 text-red-700">
                <ShieldAlert className="w-6 h-6" />
                <h3 className="font-black text-lg text-slate-900">
                  Void Sale #{voidTargetSale.receipt_no}
                </h3>
              </div>
              <button
                onClick={() => setVoidTargetSale(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleConfirmVoid} className="py-4 space-y-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1 text-xs text-red-900">
                <p className="font-bold">Void Warning:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  <li>All product quantities in this receipt will be returned to stock inventory.</li>
                  <li>
                    If paid with Cash or GCash, the amount will be deducted from your drawer or wallet balance.
                  </li>
                  <li>
                    If charged to customer credit, the customer's balance will be reverted.
                  </li>
                </ul>
              </div>

              {voidError && (
                <div className="p-2.5 bg-red-100 border border-red-300 rounded-xl text-red-800 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{voidError}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount to Void:</span>
                  <span className="font-black text-slate-900 text-sm">
                    {formatPeso(voidTargetSale.total_amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Method:</span>
                  <span className="font-bold uppercase">{voidTargetSale.payment_method}</span>
                </div>
              </div>

              {/* Owner PIN input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-amber-600" />
                  <span>Enter Owner PIN (Default: 1234):</span>
                </label>
                <input
                  type="password"
                  maxLength={8}
                  value={ownerPinInput}
                  onChange={(e) => setOwnerPinInput(e.target.value)}
                  placeholder="Enter PIN"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl font-black text-2xl text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  autoFocus
                  required
                />
              </div>

              <div className="pt-2 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVoidTargetSale(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVoiding}
                  className="touch-btn px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-md flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{isVoiding ? 'Voiding...' : 'Confirm Void Sale'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Historical Receipt Modal */}
      <ReceiptModal sale={viewReceiptSale} onClose={() => setViewReceiptSale(null)} />
    </div>
  );
};
