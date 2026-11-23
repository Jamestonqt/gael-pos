-- ==============================================================================
-- Gael-POS Supabase Database Schema
-- Run this in your Supabase SQL Editor to initialize all tables
-- ==============================================================================

-- 1. Products Table
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT,
    barcode TEXT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit_label TEXT DEFAULT 'pc',
    pack_size INTEGER DEFAULT 1,
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    stock_qty INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 5,
    has_bottle_deposit BOOLEAN DEFAULT FALSE,
    bottle_deposit_fee NUMERIC(12, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Utang Customers Table
CREATE TABLE IF NOT EXISTS utang_customers (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    nickname TEXT,
    contact_number TEXT,
    address_note TEXT,
    credit_limit NUMERIC(12, 2) DEFAULT 500.00,
    current_balance NUMERIC(12, 2) DEFAULT 0.00,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Sales Table
CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    receipt_no TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    bottle_deposit_total NUMERIC(12, 2) DEFAULT 0.00,
    discount_amount NUMERIC(12, 2) DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_profit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cash_tendered NUMERIC(12, 2) DEFAULT 0.00,
    change_due NUMERIC(12, 2) DEFAULT 0.00,
    utang_customer_id TEXT REFERENCES utang_customers(id) ON DELETE SET NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'Completed',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Utang Transactions Ledger Table
CREATE TABLE IF NOT EXISTS utang_transactions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES utang_customers(id) ON DELETE CASCADE,
    sale_id TEXT REFERENCES sales(id) ON DELETE SET NULL,
    entry_type TEXT NOT NULL, -- 'charge' or 'payment'
    payment_channel TEXT NOT NULL, -- 'Cash', 'GCash', 'Maya', 'Store Credit Adjustment'
    amount NUMERIC(12, 2) NOT NULL,
    balance_after NUMERIC(12, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Wallet Logs Table (E-load & GCash / Maya)
CREATE TABLE IF NOT EXISTS wallet_logs (
    id TEXT PRIMARY KEY,
    service_type TEXT NOT NULL, -- 'E-Load', 'GCash Cash-In', 'GCash Cash-Out', 'Maya Cash-In', etc.
    reference_no TEXT,
    recipient_or_note TEXT,
    principal_amount NUMERIC(12, 2) NOT NULL,
    fee_earned NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- Tubo / Profit
    load_wallet_delta NUMERIC(12, 2) DEFAULT 0.00,
    gcash_wallet_delta NUMERIC(12, 2) DEFAULT 0.00,
    cash_drawer_delta NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) & Allow public anon access for POS app
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE utang_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE utang_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for anon on products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon on utang_customers" ON utang_customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon on sales" ON sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon on utang_transactions" ON utang_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon on wallet_logs" ON wallet_logs FOR ALL USING (true) WITH CHECK (true);
