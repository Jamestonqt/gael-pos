import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { WalletServiceType } from '../../types';
import { formatPeso, formatDateTime } from '../../utils/formatters';
import {
  Smartphone,
  CreditCard,
  Banknote,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  ArrowRightLeft,
} from 'lucide-react';

export const WalletTracker: React.FC = () => {
  const { settings, walletLogs, recordWalletTransaction } = useStore();

  const [serviceType, setServiceType] = useState<WalletServiceType>('E-Load');
  const [principal, setPrincipal] = useState<string>('');
  const [customFee, setCustomFee] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');
  const [refNo, setRefNo] = useState<string>('');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Auto calculate default fee based on service type and principal amount
  const calculateDefaultFee = (type: WalletServiceType, amount: number): number => {
    if (amount <= 0 || isNaN(amount)) return 0;

    switch (type) {
      case 'E-Load':
        return amount <= 50 ? 3.0 : 5.0;
      case 'GCash Cash-In':
      case 'Maya Cash-In':
        // ₱10 per ₱500 bracket
        return Math.max(10, Math.ceil(amount / 500) * 10);
      case 'GCash Cash-Out':
      case 'Maya Cash-Out':
        // ₱15 per ₱500 bracket
        return Math.max(15, Math.ceil(amount / 500) * 15);
      case 'Wallet Top-Up':
        return 0;
      default:
        return 0;
    }
  };

  const numericPrincipal = parseFloat(principal) || 0;
  const autoFee = calculateDefaultFee(serviceType, numericPrincipal);
  const activeFee = customFee !== '' ? parseFloat(customFee) || 0 : autoFee;

  // Calculate quick totals
  const totalFeesEarnedToday = walletLogs
    .filter((log) => {
      const today = new Date().toDateString();
      return new Date(log.created_at).toDateString() === today;
    })
    .reduce((sum, log) => sum + log.fee_earned, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice(null);
    setSuccessNotice(null);

    if (numericPrincipal <= 0) {
      setErrorNotice('Please enter a principal amount greater than ₱0');
      return;
    }

    // Balance checks
    if (serviceType === 'E-Load' && numericPrincipal > settings.load_wallet_balance) {
      setErrorNotice(
        `Insufficient Load Wallet balance! Available: ${formatPeso(settings.load_wallet_balance)}`
      );
      return;
    }

    if (
      (serviceType === 'GCash Cash-In' || serviceType === 'Maya Cash-In') &&
      numericPrincipal > settings.gcash_wallet_balance
    ) {
      setErrorNotice(
        `Insufficient GCash/Maya balance! Available: ${formatPeso(settings.gcash_wallet_balance)}`
      );
      return;
    }

    if (
      (serviceType === 'GCash Cash-Out' || serviceType === 'Maya Cash-Out') &&
      numericPrincipal > settings.cash_drawer_balance
    ) {
      setErrorNotice(
        `Insufficient Cash in Drawer! Available: ${formatPeso(settings.cash_drawer_balance)}`
      );
      return;
    }

    try {
      const log = await recordWalletTransaction(
        serviceType,
        refNo.trim() || `REF-${Date.now().toString().slice(-6)}`,
        recipient.trim(),
        numericPrincipal,
        activeFee
      );

      setSuccessNotice(
        `Successfully recorded ${log.service_type}! Fee earned: ${formatPeso(log.fee_earned)}`
      );
      setPrincipal('');
      setCustomFee('');
      setRecipient('');
      setRefNo('');

      setTimeout(() => {
        setSuccessNotice(null);
      }, 3500);
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to record transaction');
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Running Balances Header */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {/* Load Wallet */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Load Wallet Balance
            </div>
            <div className="text-2xl font-black text-amber-600 mt-0.5">
              {formatPeso(settings.load_wallet_balance)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
            <Smartphone className="w-5 h-5" />
          </div>
        </div>

        {/* GCash / Maya Wallet */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              GCash / Maya Balance
            </div>
            <div className="text-2xl font-black text-blue-600 mt-0.5">
              {formatPeso(settings.gcash_wallet_balance)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        {/* Cash Drawer */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Cash Drawer Balance
            </div>
            <div className="text-2xl font-black text-emerald-600 mt-0.5">
              {formatPeso(settings.cash_drawer_balance)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
            <Banknote className="w-5 h-5" />
          </div>
        </div>

        {/* Total Fees Today */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Fees Earned Today
            </div>
            <div className="text-2xl font-black text-purple-600 mt-0.5">
              +{formatPeso(totalFeesEarnedToday)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Form & Recent Logs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Quick Entry Form */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 font-bold">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-base text-slate-900">Record E-Load / Digital Wallet</h2>
              <p className="text-xs text-slate-500">Auto-calculated convenience fee & balance tracking</p>
            </div>
          </div>

          {errorNotice && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorNotice}</span>
            </div>
          )}

          {successNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Service Type Selection Pills */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Select Service Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {(
                [
                  'E-Load',
                  'GCash Cash-In',
                  'GCash Cash-Out',
                  'Maya Cash-In',
                  'Maya Cash-Out',
                  'Wallet Top-Up',
                ] as WalletServiceType[]
              ).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setServiceType(type);
                    setCustomFee('');
                  }}
                  className={`touch-btn py-2 px-2.5 rounded-xl border font-bold text-xs text-center transition ${
                    serviceType === type
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Principal Amount */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Principal Amount (₱)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-500 font-black text-lg">₱</span>
                <input
                  type="number"
                  step="1"
                  value={principal}
                  onChange={(e) => {
                    setPrincipal(e.target.value);
                    setCustomFee(''); // Reset so auto fee re-calculates
                  }}
                  placeholder="0.00"
                  className="w-full pl-9 pr-3.5 py-2.5 border border-slate-300 rounded-xl font-black text-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1 mt-2">
                {(serviceType === 'E-Load' ? [20, 30, 50, 100, 150, 200] : [100, 200, 500, 1000, 2000, 5000]).map(
                  (val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setPrincipal(val.toString());
                        setCustomFee('');
                      }}
                      className="touch-btn px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs"
                    >
                      ₱{val}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Convenience Fee / Markup */}
            {serviceType !== 'Wallet Top-Up' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Convenience Fee (₱)
                  </label>
                  <span className="text-[11px] text-amber-700 font-bold">
                    Suggested Fee: {formatPeso(autoFee)}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-2 text-slate-400 font-bold">₱</span>
                  <input
                    type="number"
                    step="0.50"
                    value={customFee !== '' ? customFee : autoFee.toString()}
                    onChange={(e) => setCustomFee(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-xl font-bold text-base text-slate-900 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
            )}

            {/* Recipient details */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Mobile # / Note
                </label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0917xxxxxxx / Note"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Reference # <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={refNo}
                  onChange={(e) => setRefNo(e.target.value)}
                  placeholder="Auto-generated if blank"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Breakdown & Delta Summary */}
            {numericPrincipal > 0 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5 font-medium">
                <div className="font-bold text-slate-800 pb-1 border-b border-slate-200 flex justify-between">
                  <span>Total to Collect from Customer:</span>
                  <span className="font-black text-amber-700 text-sm">
                    {serviceType === 'GCash Cash-Out' || serviceType === 'Maya Cash-Out'
                      ? formatPeso(numericPrincipal)
                      : formatPeso(numericPrincipal + activeFee)}
                  </span>
                </div>

                <div className="text-[11px] text-slate-600 space-y-1">
                  {serviceType === 'E-Load' && (
                    <>
                      <div>• Load Wallet deducted: <strong className="text-red-600">-{formatPeso(numericPrincipal)}</strong></div>
                      <div>• Cash Drawer received: <strong className="text-emerald-700">+{formatPeso(numericPrincipal + activeFee)}</strong></div>
                    </>
                  )}
                  {(serviceType === 'GCash Cash-In' || serviceType === 'Maya Cash-In') && (
                    <>
                      <div>• Digital Wallet deducted: <strong className="text-red-600">-{formatPeso(numericPrincipal)}</strong></div>
                      <div>• Cash Drawer received: <strong className="text-emerald-700">+{formatPeso(numericPrincipal + activeFee)}</strong></div>
                    </>
                  )}
                  {(serviceType === 'GCash Cash-Out' || serviceType === 'Maya Cash-Out') && (
                    <>
                      <div>• Digital Wallet received: <strong className="text-emerald-700">+{formatPeso(numericPrincipal)}</strong></div>
                      <div>• Cash Drawer paid out: <strong className="text-red-600">-{formatPeso(numericPrincipal - activeFee)}</strong> (net of fee)</div>
                    </>
                  )}
                  {serviceType === 'Wallet Top-Up' && (
                    <>
                      <div>• Cash Drawer deducted: <strong className="text-red-600">-{formatPeso(numericPrincipal)}</strong></div>
                      <div>• Digital / Load Wallet credited: <strong className="text-emerald-700">+{formatPeso(numericPrincipal)}</strong></div>
                    </>
                  )}
                  {activeFee > 0 && (
                    <div className="font-bold text-purple-700">
                      ★ Store Fee / Profit: +{formatPeso(activeFee)}
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              className="touch-btn w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-black text-sm rounded-xl shadow-md transition"
            >
              Record Transaction
            </button>
          </form>
        </div>

        {/* Recent Wallet Logs Table */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col space-y-3">
          <div className="flex items-center justify-between pb-2 border-b">
            <div>
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                Recent E-Load & Digital Wallet Transactions
              </h3>
              <p className="text-xs text-slate-500">History of services and earned convenience fees</p>
            </div>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-full">
              {walletLogs.length} logs
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[520px] space-y-2 pr-1">
            {walletLogs.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <ArrowRightLeft className="w-10 h-10 stroke-[1.5] text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700">No wallet transactions recorded yet.</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Use the form on the left to record E-Load or GCash Cash-In/Out.
                </p>
              </div>
            ) : (
              walletLogs.map((log) => {
                const isCashIn =
                  log.service_type === 'GCash Cash-In' || log.service_type === 'Maya Cash-In';
                const isCashOut =
                  log.service_type === 'GCash Cash-Out' || log.service_type === 'Maya Cash-Out';

                return (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white transition space-y-1.5"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                              log.service_type === 'E-Load'
                                ? 'bg-amber-100 text-amber-900'
                                : isCashIn
                                ? 'bg-blue-100 text-blue-900'
                                : isCashOut
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-purple-100 text-purple-900'
                            }`}
                          >
                            {log.service_type}
                          </span>
                          <span className="text-xs font-bold text-slate-900">
                            {formatPeso(log.principal_amount)}
                          </span>
                          {log.recipient_or_note && (
                            <span className="text-xs text-slate-600 truncate">
                              • {log.recipient_or_note}
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {formatDateTime(log.created_at)} • Ref: {log.reference_no}
                        </div>
                      </div>

                      {/* Fee Earned Badge */}
                      <div className="text-right shrink-0">
                        {log.fee_earned > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-800 font-black text-xs">
                            +{formatPeso(log.fee_earned)} fee
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">No fee</span>
                        )}
                      </div>
                    </div>

                    {/* Balance Deltas */}
                    <div className="flex items-center gap-3 text-[11px] pt-1 border-t border-slate-100 text-slate-600">
                      {log.load_wallet_delta !== 0 && (
                        <span>
                          Load: <strong>{log.load_wallet_delta > 0 ? '+' : ''}{formatPeso(log.load_wallet_delta)}</strong>
                        </span>
                      )}
                      {log.gcash_wallet_delta !== 0 && (
                        <span>
                          GCash: <strong>{log.gcash_wallet_delta > 0 ? '+' : ''}{formatPeso(log.gcash_wallet_delta)}</strong>
                        </span>
                      )}
                      {log.cash_drawer_delta !== 0 && (
                        <span>
                          Drawer: <strong>{log.cash_drawer_delta > 0 ? '+' : ''}{formatPeso(log.cash_drawer_delta)}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
