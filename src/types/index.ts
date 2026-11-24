export type ProductCategory =
  | 'All'
  | 'Beverages'
  | 'Canned Goods'
  | 'Instant Noodles'
  | 'Snacks'
  | 'Toiletries/Sachets'
  | 'E-Load & GCash'
  | 'Other'
  | (string & {});

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: ProductCategory;
  unit_label: string; // e.g. "pc", "sachet", "can", "bottle", "pack"
  pack_size: number; // e.g. 12 pcs per tie, 24 bottles per case
  cost_price: number; // Puhunan
  selling_price: number; // Presyo
  stock_qty: number; // Quantity in pieces
  low_stock_threshold: number;
  has_bottle_deposit: boolean;
  bottle_deposit_fee: number; // e.g. 10.00
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  include_bottle_deposit: boolean;
  bottle_deposit_amount: number;
  custom_price?: number;
  custom_cost?: number;
}

export interface SaleItem {
  product_id: string;
  name: string;
  category: string;
  unit_price: number;
  cost_price: number;
  quantity: number;
  has_bottle_deposit: boolean;
  bottle_deposit_fee: number;
  subtotal: number;
}

export type PaymentMethod = 'Cash' | 'GCash' | 'Maya' | 'Utang';

export interface Sale {
  id: string;
  receipt_no: string;
  payment_method: PaymentMethod;
  subtotal: number;
  bottle_deposit_total: number;
  discount_amount: number;
  total_amount: number;
  total_cost: number;
  net_profit: number;
  cash_tendered: number;
  change_due: number;
  utang_customer_id: string | null;
  items: SaleItem[];
  status: 'Completed' | 'Voided';
  notes: string | null;
  created_at: string;
}

export interface UtangCustomer {
  id: string;
  full_name: string;
  nickname: string;
  contact_number: string;
  address_note: string;
  credit_limit: number;
  current_balance: number;
  is_blocked: boolean;
  created_at?: string;
  updated_at?: string;
}

export type UtangEntryType = 'charge' | 'payment';
export type UtangPaymentChannel = 'Cash' | 'GCash' | 'Maya' | 'Store Credit Adjustment';

export interface UtangTransaction {
  id: string;
  customer_id: string;
  sale_id: string | null;
  entry_type: UtangEntryType;
  payment_channel: UtangPaymentChannel;
  amount: number;
  balance_after: number;
  notes: string | null;
  created_at: string;
}

export type WalletServiceType =
  | 'E-Load'
  | 'GCash Cash-In'
  | 'GCash Cash-Out'
  | 'Maya Cash-In'
  | 'Maya Cash-Out'
  | 'Wallet Top-Up';

export interface WalletLog {
  id: string;
  service_type: WalletServiceType;
  reference_no: string;
  recipient_or_note: string;
  principal_amount: number;
  fee_earned: number; // Tubo / Convenience Fee
  load_wallet_delta: number;
  gcash_wallet_delta: number;
  cash_drawer_delta: number;
  created_at: string;
  is_voided?: boolean;
  voided_at?: string;
}

export interface StoreSettings {
  store_name: string;
  owner_pin: string; // Default: '1234'
  load_wallet_balance: number;
  gcash_wallet_balance: number;
  cash_drawer_balance: number;
  eload_default_fee: number; // e.g. 3.00 for <= 50, 5.00 for > 50
  gcash_cashin_fee_rate: number; // e.g. 2% or ₱10 per 500
  gcash_cashout_fee_rate: number;
  bottle_deposit_default_fee: number; // Default ₱10.00
  receipt_counter: number;
  custom_categories?: string[];
}

export type SyncState = 'online-synced' | 'offline-mode' | 'local-only' | 'syncing' | 'error';
