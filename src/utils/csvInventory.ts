import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { Product } from '../types';

export interface ParsedProductRow {
  id?: string;
  barcode: string;
  name: string;
  category: string;
  cost: number;
  price: number;
  stock: number;
  unit: string;
}

export interface ParsedCsvResult {
  items: ParsedProductRow[];
  categories: string[];
  totalRows: number;
  invalidRows: number;
  fileName: string;
  error?: string;
}

/**
 * Cleanly exports products to a CSV string with a UTF-8 BOM (\uFEFF)
 * so Microsoft Excel on Windows/Mac and LibreOffice open special characters
 * and Philippine Peso amounts without mojibake.
 */
export function exportProductsToCsv(products: Product[]): void {
  const headers = ['barcode', 'name', 'category', 'cost', 'price', 'stock', 'unit'];

  const rows = products.map((p) => [
    p.barcode || '',
    p.name || '',
    p.category || 'Other',
    p.cost_price.toFixed(2),
    p.selling_price.toFixed(2),
    p.stock_qty.toString(),
    p.unit_label || 'pc',
  ]);

  const csv = Papa.unparse({
    fields: headers,
    data: rows,
  });

  // Prepend UTF-8 BOM for flawless Excel compatibility
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `gael-store-inventory-${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Cleans and converts arbitrary string/number input to a clean positive number.
 * Strips Philippine Peso symbols (₱), $, Php, commas, quotes, and whitespace.
 * Defaults empty or invalid inputs to fallback (default: 0).
 */
export function parseNumberField(val: any, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') {
    return isNaN(val) || !isFinite(val) ? fallback : val;
  }
  const clean = String(val)
    .replace(/[₱$]/g, '')
    .replace(/\b(php|peso|pesos)\b/gi, '')
    .replace(/[, '"]/g, '')
    .trim();
  if (!clean) return fallback;
  // Extract leading numeric part (e.g. "60pcs", "12.50/pack", "50")
  const match = clean.match(/^-?\d+(\.\d+)?/);
  if (match) {
    const num = Number(match[0]);
    return isNaN(num) || !isFinite(num) ? fallback : num;
  }
  return fallback;
}

/**
 * Normalizes an arbitrary key-value row from CSV or Excel into a structured product row
 */
function normalizeRow(raw: Record<string, any>): ParsedProductRow | null {
  if (!raw || typeof raw !== 'object') return null;

  const keys = Object.keys(raw);

  const findValue = (...patterns: string[]): string => {
    // Exact match first (case-insensitive & trimmed)
    for (const pat of patterns) {
      const match = keys.find((k) => k.trim().toLowerCase() === pat.toLowerCase());
      if (match !== undefined && raw[match] !== undefined && raw[match] !== null) {
        return String(raw[match]).trim();
      }
    }
    // Partial inclusion match
    for (const pat of patterns) {
      const match = keys.find((k) => k.trim().toLowerCase().includes(pat.toLowerCase()));
      if (match !== undefined && raw[match] !== undefined && raw[match] !== null) {
        return String(raw[match]).trim();
      }
    }
    return '';
  };

  const name = findValue(
    'name',
    'product_name',
    'product name',
    'item',
    'item_name',
    'item name',
    'description',
    'title'
  );
  if (!name || !name.trim()) return null;

  const id = findValue('id', 'product_id', 'prod_id');
  const barcode = findValue('barcode', 'bar code', 'upc', 'ean', 'sku', 'code', 'item_code');
  const category = findValue('category', 'cat', 'group', 'classification', 'department') || 'Other';

  const cost = parseNumberField(
    findValue('cost', 'cost_price', 'cost price', 'capital', 'puhunan', 'costprice', 'buy_price'),
    0
  );
  const price = parseNumberField(
    findValue('price', 'selling_price', 'selling price', 'srp', 'sellingprice', 'retail_price', 'sale_price'),
    0
  );
  const stock = parseNumberField(
    findValue('stock', 'stock_qty', 'stock qty', 'qty', 'quantity', 'pieces', 'pcs', 'count', 'inventory'),
    0
  );
  const unit = findValue('unit', 'unit_label', 'unit label', 'uom', 'packaging', 'measure') || 'pc';

  return {
    ...(id ? { id } : {}),
    barcode: barcode.replace(/['"]+/g, '').trim(),
    name: name.trim(),
    category: category.trim() || 'Other',
    cost: Math.max(0, Number(cost.toFixed(2))),
    price: Math.max(0, Number(price.toFixed(2))),
    stock: Math.max(0, Math.round(stock)),
    unit: unit.trim().toLowerCase() || 'pc',
  };
}

/**
 * Validates, cleans, and normalizes a product row object before saving.
 * Ensures numbers are sanitized and valid, and trailing blanks are stripped.
 */
export function cleanAndNormalizeProductRow(item: Partial<ParsedProductRow> | any): ParsedProductRow | null {
  if (!item || typeof item !== 'object') return null;
  const rawName = String(item.name || '').trim();
  if (!rawName) return null;

  const barcode = String(item.barcode || '').replace(/['"]+/g, '').trim();
  const category = String(item.category || '').trim() || 'Other';
  const unit = String(item.unit || item.unit_label || 'pc').trim().toLowerCase() || 'pc';
  const cost = Math.max(0, Number(parseNumberField(item.cost ?? item.cost_price, 0).toFixed(2)));
  const price = Math.max(0, Number(parseNumberField(item.price ?? item.selling_price, 0).toFixed(2)));
  const stock = Math.max(0, Math.round(parseNumberField(item.stock ?? item.stock_qty, 0)));

  return {
    ...(item.id ? { id: String(item.id).trim() } : {}),
    barcode,
    name: rawName,
    category,
    cost,
    price,
    stock,
    unit,
  };
}

/**
 * Parses either a CSV/TSV or Excel (.xlsx/.xls) file safely
 */
export async function parseInventoryFile(file: File): Promise<ParsedCsvResult> {
  const fileName = file.name;
  const lowerName = fileName.toLowerCase();
  let rawRows: Record<string, any>[] = [];

  try {
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        return {
          items: [],
          categories: [],
          totalRows: 0,
          invalidRows: 0,
          fileName,
          error: 'The uploaded Excel file has no worksheets.',
        };
      }

      const worksheet = workbook.Sheets[firstSheetName];
      rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
    } else {
      // CSV or TSV file
      const text = await file.text();
      const parsed = Papa.parse<Record<string, any>>(text, {
        header: true,
        skipEmptyLines: 'greedy',
      });

      rawRows = parsed.data || [];
    }

    const items: ParsedProductRow[] = [];
    const categoriesSet = new Set<string>();
    let invalidRows = 0;

    for (const raw of rawRows) {
      if (!raw || typeof raw !== 'object') continue;

      // Check if row has any non-empty values at all (filter empty trailing rows)
      const values = Object.values(raw);
      const isBlankRow = values.every(
        (v) => v === null || v === undefined || String(v).trim() === ''
      );
      if (isBlankRow) {
        // Trailing empty row or blank line in CSV/Excel - silently ignore
        continue;
      }

      const item = normalizeRow(raw);
      if (item && item.name && item.name.trim()) {
        items.push(item);
        if (item.category && item.category.toLowerCase() !== 'all') {
          categoriesSet.add(item.category);
        }
      } else {
        invalidRows++;
      }
    }

    if (items.length === 0) {
      return {
        items: [],
        categories: [],
        totalRows: rawRows.length,
        invalidRows,
        fileName,
        error: 'No valid products detected. Please ensure the file has a "name" column.',
      };
    }

    return {
      items,
      categories: Array.from(categoriesSet),
      totalRows: rawRows.length,
      invalidRows,
      fileName,
    };
  } catch (err: any) {
    return {
      items: [],
      categories: [],
      totalRows: 0,
      invalidRows: 0,
      fileName,
      error: `Could not parse file: ${err?.message || 'Unsupported format'}`,
    };
  }
}
