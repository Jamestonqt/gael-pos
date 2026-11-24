/**
 * Barcode lookup utility querying Open Food Facts and Open Beauty Facts APIs.
 * Useful for auto-identifying Philippine sari-sari store groceries, beverages,
 * snacks, soaps, shampoos, and personal care items.
 */

export interface BarcodeLookupResult {
  found: boolean;
  barcode: string;
  name?: string;
  brand?: string;
  quantity?: string;
  source?: 'openfoodfacts' | 'openbeautyfacts';
}

/**
 * Cleanly combines brand, product name, and quantity string without repeating duplicate words.
 * E.g., brand: "Lucky Me!", product_name: "Lucky Me! Pancit Canton Kalamansi", quantity: "60g"
 * => "Lucky Me! Pancit Canton Kalamansi 60g"
 */
export function formatProductName(brand?: string, productName?: string, quantity?: string): string {
  const b = (brand || '').trim();
  const p = (productName || '').trim();
  const q = (quantity || '').trim();

  let combined = p;

  if (b && p) {
    const bLower = b.toLowerCase();
    const pLower = p.toLowerCase();
    if (!pLower.startsWith(bLower)) {
      combined = `${b} ${p}`;
    }
  } else if (b && !p) {
    combined = b;
  }

  if (q && combined) {
    const qLower = q.toLowerCase();
    const cLower = combined.toLowerCase();
    if (!cLower.includes(qLower)) {
      combined = `${combined} ${q}`;
    }
  }

  return combined.trim();
}

/**
 * Look up a barcode against free public APIs in sequence:
 * 1. Open Food Facts (for canned goods, drinks, noodles, snacks, condiments)
 * 2. Open Beauty Facts (for shampoos, soaps, lotions, toothpaste, toiletries)
 */
export async function lookupBarcodeOnline(barcode: string): Promise<BarcodeLookupResult> {
  const cleanBarcode = barcode.trim();
  if (!cleanBarcode) {
    return { found: false, barcode: '' };
  }

  // 1. Try Open Food Facts
  try {
    const foodUrl = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      cleanBarcode
    )}.json?fields=product_name,brands,quantity`;
    const res = await fetch(foodUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 1 && data.product?.product_name?.trim()) {
        const brand = (data.product.brands || '').trim();
        const rawName = (data.product.product_name || '').trim();
        const quantity = (data.product.quantity || '').trim();
        const formattedName = formatProductName(brand, rawName, quantity);

        return {
          found: true,
          barcode: cleanBarcode,
          name: formattedName,
          brand,
          quantity,
          source: 'openfoodfacts',
        };
      }
    }
  } catch (err) {
    console.warn('Open Food Facts API request error:', err);
  }

  // 2. Try Open Beauty Facts
  try {
    const beautyUrl = `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(
      cleanBarcode
    )}.json?fields=product_name,brands,quantity`;
    const res = await fetch(beautyUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 1 && data.product?.product_name?.trim()) {
        const brand = (data.product.brands || '').trim();
        const rawName = (data.product.product_name || '').trim();
        const quantity = (data.product.quantity || '').trim();
        const formattedName = formatProductName(brand, rawName, quantity);

        return {
          found: true,
          barcode: cleanBarcode,
          name: formattedName,
          brand,
          quantity,
          source: 'openbeautyfacts',
        };
      }
    }
  } catch (err) {
    console.warn('Open Beauty Facts API request error:', err);
  }

  return { found: false, barcode: cleanBarcode };
}
