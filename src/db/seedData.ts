import type { Product, UtangCustomer, StoreSettings } from '../types/index.ts';

export const DEMO_PRODUCT_IDS = [
  'prod_coke_kasalo',
  'prod_smb_pale',
  'prod_c2_green_tea',
  'prod_lucky_me_kalamansi',
  'prod_lucky_me_hot_chili',
  'prod_lucky_me_beef',
  'prod_sardines_555',
  'prod_century_tuna',
  'prod_argentina_corned_beef',
  'prod_nescafe_orig',
  'prod_kopiko_blanca',
  'prod_bear_brand',
  'prod_ding_dong',
  'prod_safeguard_white',
  'prod_sunsilk_pink',
  'prod_silver_swan_toyo',
];

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_CUSTOMERS: UtangCustomer[] = [
  {
    id: 'cust_aling_nena',
    full_name: 'Elena "Aling Nena" Dela Cruz',
    nickname: 'Aling Nena',
    contact_number: '09171234567',
    address_note: 'Yellow gate next to chapel',
    credit_limit: 800.00,
    current_balance: 145.00,
    is_blocked: false,
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'cust_mang_berting',
    full_name: 'Alberto "Mang Berting" Santos',
    nickname: 'Mang Berting (Tricycle)',
    contact_number: '09289876543',
    address_note: 'Tricycle terminal operator',
    credit_limit: 500.00,
    current_balance: 485.00, // Near Limit!
    is_blocked: false,
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    id: 'cust_nanay_glo',
    full_name: 'Gloria "Nanay Glo" Ramos',
    nickname: 'Nanay Glo',
    contact_number: '09395551234',
    address_note: 'Purok 3, across barangay hall',
    credit_limit: 1000.00,
    current_balance: 0.00, // Good standing
    is_blocked: false,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  }
];

export const INITIAL_SETTINGS: StoreSettings = {
  store_name: 'Gael Store',
  owner_pin: '1234',
  load_wallet_balance: 1500.00,
  gcash_wallet_balance: 4500.00,
  cash_drawer_balance: 2000.00,
  eload_default_fee: 3.00, // e.g. ₱3 under ₱50, ₱5 above
  gcash_cashin_fee_rate: 10.00, // ₱10 per ₱500
  gcash_cashout_fee_rate: 15.00,
  bottle_deposit_default_fee: 10.00,
  receipt_counter: 1001,
  custom_categories: [
    'Beverages',
    'Canned Goods',
    'Instant Noodles',
    'Snacks',
    'Toiletries/Sachets',
    'Other',
  ],
};
