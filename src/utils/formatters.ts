/**
 * Formats a number to Philippine Peso (₱) standard formatting.
 * Examples: formatPeso(25) => "₱25.00", formatPeso(1500.5) => "₱1,500.50"
 */
export function formatPeso(amount: number, showDecimals: boolean = true): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '₱0.00';
  }

  const formatted = Math.abs(amount).toLocaleString('en-PH', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });

  const sign = amount < 0 ? '-' : '';
  return `${sign}₱${formatted}`;
}

export function formatDateTime(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateString;
  }
}

export function formatDateShort(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatTimeShort(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleTimeString('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateString;
  }
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateId(prefix: string = 'id'): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${randomStr}`;
}

export function generateReceiptNo(counter: number): string {
  const today = new Date();
  const dateCode = today.toISOString().slice(2, 10).replace(/-/g, '');
  const padded = String(counter).padStart(4, '0');
  return `GL-${dateCode}-${padded}`;
}
