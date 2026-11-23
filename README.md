# Gael-POS 🇵🇭 | Sari-Sari Store Point of Sale & Utang Tracker

A responsive, offline-first Progressive Web App (PWA) tailored for Philippine Sari-Sari Stores, mini-groceries, and neighborhood retail stalls. Built with React, TypeScript, Tailwind CSS, IndexedDB, and Supabase.

---

## 🌟 Key Features

### 1. Offline-First Architecture & PWA
- **Installable PWA**: Works as an installable standalone app on Android, iOS, Windows, and macOS home screens.
- **Local Storage in IndexedDB**: Full offline checkout, lista tracking, and inventory without requiring an active internet connection. Falls back gracefully to `localStorage` if needed.
- **Supabase Cloud Sync**: Dual-mode capability. Runs in **"Local Only"** mode by default or seamlessly connects to Supabase tables with background sync queue flushing and remote pull.
- **Live Sync Indicator**: Visual header pill showing `Online / Synced`, `Offline Mode`, or `Local Only`.
- **JSON Backup & Restore**: One-click full export and import of products, sales, utang records, wallet logs, and store settings.

### 2. POS Checkout Screen (Main View)
- **Quick-Tap Product Grid**: Large, high-contrast, touch-optimized product cards.
- **Category Filter Pills**: All, Beverages, Canned Goods, Instant Noodles, Snacks, Toiletries/Sachets, Other.
- **Live Search**: Instant filtering by product name, SKU, or barcode.
- **Custom Tingi / Manual Item**: Fast modal to add unbarcoded items (e.g. repacked garlic, ice candy, single cigarette sticks) with custom selling prices and optional puhunan.
- **Shopping Cart Panel**:
  - Quantity steppers (`+` / `-`).
  - **Bottle Deposit (+₱10) Toggle**: Add/remove deposit on returnable soft drink and beer glass bottles.
- **Instant Change Calculator**:
  - Quick peso bill buttons: `Exact`, `₱20`, `₱50`, `₱100`, `₱200`, `₱500`, `₱1000`.
  - Real-time display for **Sukli (Change Due)** or **Kulang (Shortage)**.
- **Three Checkout Payment Methods**:
  - 💵 **Cash**: Deducts stock, adds to Cash Drawer and gross sales.
  - 💳 **GCash / Maya**: Deducts stock, credits digital wallet balance.
  - 📝 **Utang / Credit**: Verifies credit limit, blocks over-limit/blocked suki, charges customer balance, and creates an audit transaction in the ledger.
- **Thermal Printable Receipt**: Complete itemized receipt with date/time, receipt #, and "Salamat sa Pagbili!".

### 3. Digital Lista (Utang / Credit Tracker)
- **Suki Directory**: View full name, nickname, phone, address notes, current debt balance, credit limit, and status badge (`Good Standing`, `Near Limit`, `Over Limit`, `Blocked`).
- **Credit Limit Checks**: Default ₱500 limit (customizable per suki). Automatically prevents checkout if the charge exceeds the credit limit.
- **Record Payment Modal**: Accepts full or partial payments via Cash, GCash, or Maya with quick preset chips (Full, 50%, ₱50, ₱100, ₱200).
- **Expandable Customer Ledger**: Complete timestamped audit history of all charges and payments.

### 4. E-Load & GCash Service Tracker
- Supports **E-Load**, **GCash Cash-In**, **GCash Cash-Out**, **Maya Cash-In**, **Maya Cash-Out**, and **Wallet Top-Up**.
- **Automated Convenience Fee (Tubo)**:
  - E-Load: ₱3 (≤ ₱50) or ₱5 (> ₱50).
  - Cash-In: ₱10 per ₱500 bracket.
  - Cash-Out: ₱15 per ₱500 bracket.
- **Running Balance Tracking**: Accurately tracks `load_wallet_delta`, `gcash_wallet_delta`, and `cash_drawer_delta`.

### 5. Inventory & Pack-to-Piece Management
- Searchable product table with SKU, Barcode, Puhunan, Presyo, Profit per piece, Margin %, and Stock (pcs).
- **Restock by Pack/Case**: Automatically calculates and multiplies wholesale packs (e.g., 1 tie = 12 pcs, 1 case = 24 bottles) into stock pieces.
- Pre-seeded with 15 realistic Philippine sari-sari store items and 3 sample suki profiles on first run.

### 6. Daily Z-Reading & Profit Report
- Summary metrics:
  1. Today's Gross Sales (Benta)
  2. Net Profit (Tunay na Kita: Paninda Profit + E-Load Tubo)
  3. Total Cash Collected (Cash sales + Utang payments + Cash from load/GCash)
  4. Total GCash & Maya Digital Sales
  5. E-Load / GCash Fees Earned (Tubo)
  6. New Utang Issued
- **Top-Selling Products**: Ranked by quantity sold with revenue and profit breakdown.
- **PIN-Protected Void/Refund**: Protected by Owner PIN (Default: `1234`, editable in Settings). Restores inventory, reverses customer balances, and adjusts drawer totals.

---

## 🗄️ Supabase Configuration

To connect Gael-POS to Supabase:
1. Copy `.env.example` to `.env`:
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
2. Execute the included SQL migration in your Supabase SQL Editor:
   - See [supabase-schema.sql](file:///c:/Users/HOME/Documents/gael-pos/supabase-schema.sql)

The schema defines:
- `products`
- `sales`
- `utang_customers`
- `utang_transactions`
- `wallet_logs`

---

## 🚀 Running the App

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run automated test suite
node --experimental-strip-types test-runner.ts

# Build production bundle
npm run build

# Preview production build
npm run preview
```
