import React from 'react';
import { Sale } from '../../types';
import { formatPeso, formatDateTime } from '../../utils/formatters';
import { Printer, CheckCircle2, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { playSound } from '../../utils/audio';

interface ReceiptModalProps {
  sale: Sale | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, onClose }) => {
  const { settings, customers } = useStore();

  if (!sale) return null;

  const utangCustomer = sale.utang_customer_id
    ? customers.find((c) => c.id === sale.utang_customer_id)
    : null;

  const handlePrint = () => {
    playSound.tap();
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print:static print:inset-auto print:bg-white print:p-0 print:m-0 print:block print:overflow-visible print:max-h-none print:w-full">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] print:static print:inset-auto print:bg-white print:p-0 print:m-0 print:max-w-none print:w-full print:border-none print:shadow-none print:rounded-none print:max-h-none print:overflow-visible">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b print:hidden">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="font-black text-slate-900">Sale Completed!</span>
          </div>
          <button
            onClick={() => {
              playSound.tap();
              onClose();
            }}
            aria-label="Close receipt dialog"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thermal Printable Receipt */}
        <div
          id="printable-receipt"
          className="receipt-print-area my-3 p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl font-mono text-xs text-slate-800 overflow-y-auto space-y-3 print:my-0 print:p-0 print:bg-white print:border-none print:overflow-visible print:max-h-none"
        >
          {/* Header */}
          <div className="text-center space-y-1">
            <img
              src="/logo.jpg"
              alt="Gael Store"
              width="56"
              height="56"
              className="w-14 h-14 object-contain mx-auto mb-1 bg-white rounded-lg p-0.5 border border-slate-200"
            />
            <h3 className="font-black text-sm uppercase tracking-wide text-slate-900">
              {settings.store_name}
            </h3>
            <p className="text-[10px] text-slate-500">Official Store Receipt</p>
            <p className="text-[10px] text-slate-500">{formatDateTime(sale.created_at)}</p>
            <p className="text-[10px] font-bold text-slate-700">Receipt #: {sale.receipt_no}</p>
          </div>

          <div className="border-t border-dashed border-slate-300 my-2" />

          {/* Items Table */}
          <div className="space-y-1.5">
            {sale.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start text-[11px]">
                <div className="pr-2 flex-1">
                  <div className="font-bold text-slate-900">{item.name}</div>
                  <div className="text-[10px] text-slate-500">
                    {item.quantity} x {formatPeso(item.unit_price)}
                    {item.has_bottle_deposit && (
                      <span className="text-amber-700 font-medium"> (+{formatPeso(item.bottle_deposit_fee)} dep)</span>
                    )}
                  </div>
                </div>
                <div className="font-bold text-slate-900 shrink-0">
                  {formatPeso(item.subtotal)}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-slate-300 my-2" />

          {/* Subtotals & Totals */}
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal:</span>
              <span>{formatPeso(sale.subtotal)}</span>
            </div>
            {sale.bottle_deposit_total > 0 && (
              <div className="flex justify-between text-amber-700 font-medium">
                <span>Bottle Deposit:</span>
                <span>+{formatPeso(sale.bottle_deposit_total)}</span>
              </div>
            )}
            {sale.discount_amount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount:</span>
                <span>-{formatPeso(sale.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-sm pt-1 border-t text-slate-950">
              <span>TOTAL DUE:</span>
              <span>{formatPeso(sale.total_amount)}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-slate-300 my-2" />

          {/* Payment breakdown */}
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-600">Payment Method:</span>
              <span className="font-black uppercase">{sale.payment_method}</span>
            </div>
            {sale.payment_method === 'Cash' && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-600">Cash Tendered:</span>
                  <span>{formatPeso(sale.cash_tendered)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-700 text-xs">
                  <span>Change Due:</span>
                  <span>{formatPeso(sale.change_due)}</span>
                </div>
              </>
            )}
            {sale.payment_method === 'Utang' && utangCustomer && (
              <div className="mt-1 p-1.5 bg-brand-50 border border-brand-200 rounded text-[10px] space-y-0.5">
                <div className="font-bold text-brand-900">Charged to: {utangCustomer.full_name}</div>
                <div>Account Balance: {formatPeso(utangCustomer.current_balance)}</div>
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="text-center pt-2 text-[10px] text-slate-500 italic">
            *** Thank you for your purchase! ***
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex gap-2 pt-2 border-t print:hidden">
          <button
            onClick={handlePrint}
            aria-label="Print receipt on thermal printer"
            className="touch-btn flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>
          <button
            onClick={() => {
              playSound.tap();
              onClose();
            }}
            aria-label="Start new transaction"
            className="touch-btn flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-black text-sm shadow-md"
          >
            New Sale
          </button>
        </div>
      </div>
    </div>
  );
};
