/** Helpers for the card form: brand, number grouping, expiry and the Luhn check. Nothing here leaves the device. */

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'elo' | 'hipercard' | 'unknown';

export const CARD_BRAND_LABEL: Readonly<Record<CardBrand, string>> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'Amex',
  elo: 'Elo',
  hipercard: 'Hipercard',
  unknown: 'Cartão',
};

const ELO = /^(4011(78|79)|43(1274|8935)|45(1416|7393|763[12])|50(4175|6699|67[0-6]\d|677[0-8]|9\d{3})|627780|63(6297|6368|6369)|65(0(0(3[1-3]|3[5-9]|4\d|5[0-1])|4(0[5-9]|[1-3]\d|8[5-9]|9\d)|5([0-2]\d|3[0-8]|4[1-9]|[5-8]\d|9[0-8])|7([0-2]\d|3[0-8]|4[1-9]|[5-9]\d))|16(5[2-9]|[6-7]\d)|50(0\d|1[0-9]|2[1-9]|[3-4]\d|5[0-8])))/;

export function detectBrand(number: string): CardBrand {
  const d = number.replace(/\D/g, '');
  if (d.length === 0) return 'unknown';
  if (ELO.test(d)) return 'elo';
  if (/^(606282|3841)/.test(d)) return 'hipercard';
  if (/^3[47]/.test(d)) return 'amex';
  if (/^4/.test(d)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'mastercard';
  return 'unknown';
}

/** Groups digits as typed: `4111 1111 1111 1111` (Amex: `3782 822463 10005`). Keeps at most 19 digits. */
export function maskCardNumber(value: string): string {
  const d = value.replace(/\D/g, '');
  if (/^3[47]/.test(d)) {
    const a = d.slice(0, 15);
    return [a.slice(0, 4), a.slice(4, 10), a.slice(10, 15)].filter(Boolean).join(' ');
  }
  return (d.slice(0, 19).match(/.{1,4}/g) ?? []).join(' ');
}

/** `1228` -> `12/28`. Month 2-9 typed first becomes `02`..`09`. */
export function maskExpiry(value: string): string {
  let d = value.replace(/\D/g, '').slice(0, 4);
  if (d.length === 1 && Number(d) > 1) {
    d = `0${d}`;
  }
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export function luhn(number: string): boolean {
  const d = number.replace(/\D/g, '');
  if (d.length < 13) return false;
  let sum = 0;
  let double = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

/** `{ month: '12', year: '2030' }` for `12/30`, or `null` when it is not a date in the future. */
export function parseExpiry(value: string, now = new Date()): { month: string; year: string } | null {
  const m = /^(\d{2})\/(\d{2})$/.exec(value);
  if (!m) return null;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return null;
  const thisMonth = now.getFullYear() * 12 + now.getMonth();
  if (year * 12 + (month - 1) < thisMonth) return null;
  return { month: m[1], year: String(year) };
}
