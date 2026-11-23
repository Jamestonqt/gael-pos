# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Sari-sari store owners and cashiers in the Philippines managing high-frequency over-the-counter retail transactions on smartphones, tablets, or counter laptops.

## Product Purpose

Provide a fast, tactile, offline-first Progressive Web App (PWA) Point of Sale (POS) and ledger system. It enables instantaneous ringing up of items, customer credit (utang) accounting, E-Load / digital wallet service fee tracking, and end-of-day sales reconciliation without requiring a persistent internet connection.

## Positioning

Tailored specifically to the realities of Philippine retail operations (sari-sari store commerce): tingi sales (single-piece / repacked goods), bottle deposit accounting for soft drinks and beer, digital lista credit limits, GCash/Maya convenience fees, and seamless local IndexedDB persistence with optional cloud sync to Supabase.

## Operating Context

- Fast-paced counter interactions with noisy environments and direct sunlight.
- Devices range from low-to-midrange Android mobile phones to desktop counter setups.
- Intermittent connectivity: checkout and ledger must function with zero network latency.
- Supported peripherals: device rear camera for barcode scanning (`html5-qrcode`), USB/Bluetooth handheld barcode scanners, and standard 58mm/80mm thermal receipt printers.

## Capabilities and Constraints

- **Offline-First Storage**: Local IndexedDB via `idb` with automatic queueing for Supabase sync.
- **Product Catalog**: SKU, barcode, unit label (pc/pack/bottle), cost price, selling price, stock quantity, low-stock threshold, bottle deposit toggle.
- **Checkout & Instant Change**: Realtime change calculation, quick peso denomination buttons (Exact, ₱20, ₱50, ₱100, ₱200, ₱500, ₱1000), three checkout methods (Cash, GCash/Maya, Customer Credit).
- **Customer Credit Ledger (Utang)**: Credit limit enforcement, customer balance ledger, partial/full payment recording across Cash/GCash/Maya.
- **Digital Wallet & E-Load**: Auto fee calculation, wallet balance tracking (Load Wallet, GCash/Maya Wallet, Cash Drawer).
- **Daily Reports & Security**: Z-Reading gross sales, net profit margin, cash breakdown, 4-digit Owner PIN protection for voids.
- **Language**: English interface throughout.

## Brand Commitments

- **Name**: Gael Store (Gael-POS).
- **Branding**: Gael Store "GS" logo (Black "G" and Blue "S").
- **Visual Identity**: Electric Brand Blue (`#1b4deb` / `brand-600`) paired with deep slate surfaces (`#0f172a`), emerald accents for cash/success, and clear contrast.

## Evidence on Hand

- Brand assets: `public/logo.jpg`, `public/favicon.png`, `public/icons/icon-192x192.png`, `public/icons/icon-512x512.png`.
- Supabase schema: `supabase-schema.sql`.
- 15 realistic Philippine sari-sari store seed items and 3 initial credit customers in `src/db/seedData.ts`.

## Product Principles

1. **Zero-Latency Checkout**: Taps, quantity adjustments, and change calculations must update instantaneously with tactile sound feedback.
2. **Clutter-Free Ergonomics**: Every action needed to ring up a sale must be reachable with one thumb or hand on mobile, avoiding competing or duplicate buttons.
3. **Fail-Safe Accounting**: Money, stock, and credit balances must remain strictly consistent between local IndexedDB and Supabase.
4. **Touch & Scan First**: Optimized for both high-speed camera scanning on phones and physical barcode guns on counters.
