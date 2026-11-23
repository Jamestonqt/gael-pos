import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { UtangCustomer, UtangPaymentChannel } from '../../types';
import { formatPeso, formatDateTime } from '../../utils/formatters';
import {
  BookOpen,
  UserPlus,
  Search,
  Phone,
  MapPin,
  ChevronDown,
  ChevronUp,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit2,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  ShieldAlert,
} from 'lucide-react';

export const UtangTracker: React.FC = () => {
  const { customers, transactions, recordUtangPayment, addOrUpdateCustomer } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'with-utang' | 'settled' | 'near-limit'>('all');
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);

  // Modal states
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<UtangCustomer | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payingCustomer, setPayingCustomer] = useState<UtangCustomer | null>(null);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentChannel, setPaymentChannel] = useState<UtangPaymentChannel>('Cash');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Customer form state
  const [custName, setCustName] = useState('');
  const [custNickname, setCustNickname] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custLimit, setCustLimit] = useState('500');
  const [custIsBlocked, setCustIsBlocked] = useState(false);
  const [custFormError, setCustFormError] = useState<string | null>(null);

  // Summary Metrics
  const totalUtang = customers.reduce((sum, c) => sum + c.current_balance, 0);
  const customersWithDebt = customers.filter((c) => c.current_balance > 0).length;
  const nearLimitCount = customers.filter((c) => {
    const ratio = c.credit_limit > 0 ? c.current_balance / c.credit_limit : 0;
    return ratio >= 0.8;
  }).length;

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return customers.filter((c) => {
      const matchesSearch =
        !q ||
        c.full_name.toLowerCase().includes(q) ||
        c.nickname.toLowerCase().includes(q) ||
        c.contact_number.includes(q) ||
        c.address_note.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (filterType === 'with-utang') return c.current_balance > 0;
      if (filterType === 'settled') return c.current_balance === 0;
      if (filterType === 'near-limit') {
        const ratio = c.credit_limit > 0 ? c.current_balance / c.credit_limit : 0;
        return ratio >= 0.75;
      }

      return true;
    });
  }, [customers, searchQuery, filterType]);

  // Handle open add / edit modal
  const handleOpenAddCustomer = () => {
    setEditingCustomer(null);
    setCustName('');
    setCustNickname('');
    setCustPhone('');
    setCustAddress('');
    setCustLimit('500');
    setCustIsBlocked(false);
    setCustFormError(null);
    setShowCustomerModal(true);
  };

  const handleOpenEditCustomer = (c: UtangCustomer) => {
    setEditingCustomer(c);
    setCustName(c.full_name);
    setCustNickname(c.nickname);
    setCustPhone(c.contact_number);
    setCustAddress(c.address_note);
    setCustLimit(c.credit_limit.toString());
    setCustIsBlocked(c.is_blocked);
    setCustFormError(null);
    setShowCustomerModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) {
      setCustFormError('Full name is required.');
      return;
    }
    const limit = parseFloat(custLimit);
    if (isNaN(limit) || limit < 0) {
      setCustFormError('A valid credit limit is required.');
      return;
    }

    await addOrUpdateCustomer({
      id: editingCustomer?.id,
      full_name: custName.trim(),
      nickname: custNickname.trim(),
      contact_number: custPhone.trim(),
      address_note: custAddress.trim(),
      credit_limit: limit,
      current_balance: editingCustomer?.current_balance ?? 0,
      is_blocked: custIsBlocked,
    });

    setShowCustomerModal(false);
  };

  // Handle payment modal
  const handleOpenPayment = (c: UtangCustomer) => {
    setPayingCustomer(c);
    setPaymentAmount(c.current_balance.toString());
    setPaymentChannel('Cash');
    setPaymentNotes('');
    setPaymentError(null);
    setShowPaymentModal(true);
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCustomer) return;

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setPaymentError('Please enter a valid amount greater than ₱0.');
      return;
    }

    if (amt > payingCustomer.current_balance) {
      setPaymentError(
        `Payment (₱${amt}) cannot exceed current credit balance (${formatPeso(payingCustomer.current_balance)}).`
      );
      return;
    }

    setIsSubmittingPayment(true);
    const res = await recordUtangPayment(payingCustomer.id, amt, paymentChannel, paymentNotes);
    setIsSubmittingPayment(false);

    if (res.success) {
      setShowPaymentModal(false);
      setPayingCustomer(null);
    } else {
      setPaymentError(res.error || 'Failed to record payment');
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Top Banner & Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Outstanding Credit
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 mt-0.5">
              {formatPeso(totalUtang)}
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Customers with Balance
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5">
              {customersWithDebt}{' '}
              <span className="text-xs font-semibold text-slate-400">
                / {customers.length} total
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Near / Over Credit Limit
            </div>
            <div className="text-2xl sm:text-3xl font-black text-red-600 mt-0.5">
              {nearLimitCount}
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center text-red-700">
            <AlertTriangle className="w-6 h-6" />
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
            placeholder="Search by name, contact, or address..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto bg-slate-200/80 p-1 rounded-xl">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterType === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({customers.length})
            </button>
            <button
              onClick={() => setFilterType('with-utang')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterType === 'with-utang'
                  ? 'bg-white text-amber-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              With Balance ({customersWithDebt})
            </button>
            <button
              onClick={() => setFilterType('near-limit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterType === 'near-limit'
                  ? 'bg-white text-red-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Near Limit ({nearLimitCount})
            </button>
          </div>

          {/* Add Customer Button */}
          <button
            onClick={handleOpenAddCustomer}
            className="touch-btn flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ New Customer</span>
          </button>
        </div>
      </div>

      {/* Customers Directory */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400">
            <BookOpen className="w-12 h-12 stroke-[1.5] text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-700">No customers found.</p>
            <p className="text-xs text-slate-500 mt-1">
              Add a new customer account using the "+ New Customer" button above.
            </p>
          </div>
        ) : (
          filteredCustomers.map((cust) => {
            const ratio = cust.credit_limit > 0 ? cust.current_balance / cust.credit_limit : 0;
            const isOverLimit = cust.current_balance > cust.credit_limit;
            const isNearLimit = !isOverLimit && ratio >= 0.75;
            const isExpanded = expandedCustomerId === cust.id;

            // Customer ledger
            const customerTxs = transactions.filter((t) => t.customer_id === cust.id);

            return (
              <div
                key={cust.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition overflow-hidden flex flex-col"
              >
                {/* Customer Card Header */}
                <div className="p-4 flex-1 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-base text-slate-900 truncate">
                          {cust.full_name}
                        </h3>
                        {cust.nickname && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-xs font-bold">
                            "{cust.nickname}"
                          </span>
                        )}
                      </div>

                      {/* Contact details */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                        {cust.contact_number && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {cust.contact_number}
                          </span>
                        )}
                        {cust.address_note && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {cust.address_note}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0 flex items-center gap-1">
                      {cust.is_blocked ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" />
                          Blocked
                        </span>
                      ) : isOverLimit ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-red-100 text-red-800 border border-red-200">
                          Over Limit
                        </span>
                      ) : isNearLimit ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
                          Near Limit
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Good Standing
                        </span>
                      )}

                      <button
                        onClick={() => handleOpenEditCustomer(cust)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                        title="Edit Customer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Credit Bar & Balance */}
                  <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 border border-slate-100">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="font-bold text-slate-600">Current Balance:</span>
                      <div className="text-right">
                        <span className="font-black text-xl text-slate-900">
                          {formatPeso(cust.current_balance)}
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold ml-1">
                          / Limit {formatPeso(cust.credit_limit)}
                        </span>
                      </div>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isOverLimit
                            ? 'bg-red-600'
                            : isNearLimit
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, ratio * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleOpenPayment(cust)}
                      disabled={cust.current_balance <= 0}
                      className="touch-btn flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black text-xs rounded-xl shadow-sm transition"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>Record Payment</span>
                    </button>

                    <button
                      onClick={() =>
                        setExpandedCustomerId(isExpanded ? null : cust.id)
                      }
                      className="touch-btn px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1 transition"
                    >
                      <span>Ledger</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expandable Timestamped Ledger */}
                {isExpanded && (
                  <div className="bg-slate-50 border-t border-slate-200 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-700 pb-1 border-b border-slate-200">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Credit & Payment History (Ledger)
                      </span>
                      <span className="text-[11px] text-slate-500 font-normal">
                        {customerTxs.length} record{customerTxs.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {customerTxs.length === 0 ? (
                      <p className="text-center py-4 text-slate-400 italic">
                        No transactions recorded for this customer yet.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {customerTxs.map((tx) => {
                          const isCharge = tx.entry_type === 'charge';

                          return (
                            <div
                              key={tx.id}
                              className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase ${
                                      isCharge
                                        ? 'bg-amber-100 text-amber-900'
                                        : 'bg-emerald-100 text-emerald-900'
                                    }`}
                                  >
                                    {isCharge ? 'Charged' : 'Payment'}
                                  </span>
                                  <span className="text-[11px] font-bold text-slate-700 truncate">
                                    via {tx.payment_channel}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {formatDateTime(tx.created_at)}
                                  {tx.notes && ` • ${tx.notes}`}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <div
                                  className={`font-black text-xs sm:text-sm ${
                                    isCharge ? 'text-amber-700' : 'text-emerald-700'
                                  }`}
                                >
                                  {isCharge ? '+' : '-'}
                                  {formatPeso(tx.amount)}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  Bal: {formatPeso(tx.balance_after)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Record Payment Modal */}
      {showPaymentModal && payingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h3 className="font-black text-lg text-slate-900">Record Credit Payment</h3>
                <p className="text-xs text-slate-500">
                  Customer: <strong className="text-slate-800">{payingCustomer.full_name}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleProcessPayment} className="py-4 space-y-4">
              {paymentError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{paymentError}</span>
                </div>
              )}

              {/* Current Debt Card */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex justify-between items-center">
                <span className="text-xs font-bold text-amber-900">Current Outstanding Balance:</span>
                <span className="text-xl font-black text-amber-900">
                  {formatPeso(payingCustomer.current_balance)}
                </span>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Payment Amount (₱)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-black text-lg">₱</span>
                  <input
                    type="number"
                    step="0.50"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-9 pr-3.5 py-2.5 border border-slate-300 rounded-xl font-black text-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                    autoFocus
                  />
                </div>

                {/* Quick Payment Preset Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(payingCustomer.current_balance.toString())}
                    className="touch-btn px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs"
                  >
                    Full: {formatPeso(payingCustomer.current_balance)}
                  </button>
                  {payingCustomer.current_balance > 50 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentAmount(Math.round(payingCustomer.current_balance / 2).toString())
                      }
                      className="touch-btn px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs"
                    >
                      50%: {formatPeso(Math.round(payingCustomer.current_balance / 2))}
                    </button>
                  )}
                  {[50, 100, 200, 500].map((v) => {
                    if (v < payingCustomer.current_balance) {
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setPaymentAmount(v.toString())}
                          className="touch-btn px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs"
                        >
                          ₱{v}
                        </button>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>

              {/* Payment Channel Radio Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentChannel('Cash')}
                    className={`touch-btn py-2 px-3 rounded-xl border flex flex-col items-center gap-1 font-bold text-xs ${
                      paymentChannel === 'Cash'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    <span>Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentChannel('GCash')}
                    className={`touch-btn py-2 px-3 rounded-xl border flex flex-col items-center gap-1 font-bold text-xs ${
                      paymentChannel === 'GCash'
                        ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    <span>GCash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentChannel('Maya')}
                    className={`touch-btn py-2 px-3 rounded-xl border flex flex-col items-center gap-1 font-bold text-xs ${
                      paymentChannel === 'Maya'
                        ? 'bg-emerald-950/10 border-emerald-800 text-emerald-900 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-emerald-800" />
                    <span>Maya</span>
                  </button>
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Notes / Receipt Reference # <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Over-the-counter payment, Ref 12345"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Realtime balance preview */}
              {parseFloat(paymentAmount) > 0 && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center text-xs">
                  <span className="font-bold text-emerald-900">Remaining Balance After Payment:</span>
                  <span className="font-black text-sm text-emerald-950">
                    {formatPeso(
                      Math.max(0, payingCustomer.current_balance - (parseFloat(paymentAmount) || 0))
                    )}
                  </span>
                </div>
              )}

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="touch-btn px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-md flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmittingPayment ? 'Saving...' : 'Record Payment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-black text-lg text-slate-900">
                {editingCustomer ? 'Edit Customer Profile' : 'Add New Customer Account'}
              </h3>
              <button
                onClick={() => setShowCustomerModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="py-4 space-y-3.5">
              {custFormError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold">
                  {custFormError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="e.g. Maria Dela Cruz"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Nickname
                  </label>
                  <input
                    type="text"
                    value={custNickname}
                    onChange={(e) => setCustNickname(e.target.value)}
                    placeholder="e.g. Aling Maria"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Contact Number
                  </label>
                  <input
                    type="text"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="0917xxxxxxx"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Address / Location Note
                </label>
                <input
                  type="text"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  placeholder="e.g. Block 4 Lot 2, near the chapel"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Credit Limit (Default: ₱500)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2 text-slate-500 font-bold">₱</span>
                  <input
                    type="number"
                    step="50"
                    value={custLimit}
                    onChange={(e) => setCustLimit(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
              </div>

              {/* Blocked toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={custIsBlocked}
                    onChange={(e) => setCustIsBlocked(e.target.checked)}
                    className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                  />
                  <div>
                    <div className="font-bold text-xs text-slate-900">
                      Block customer from new credit charges
                    </div>
                    <div className="text-[11px] text-slate-500">
                      The customer will not be allowed to checkout with credit while blocked.
                    </div>
                  </div>
                </label>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="touch-btn px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-black text-xs sm:text-sm shadow-md"
                >
                  {editingCustomer ? 'Update Profile' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
