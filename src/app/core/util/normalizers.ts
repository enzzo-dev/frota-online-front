/** Input normalizers: the API expects clean values, people type them with punctuation. */

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** `(11) 99999-9999` -> `+5511999999999`. Numbers that already carry a country code are kept. */
export function normalizePhone(value: string): string {
  const digits = digitsOnly(value);
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  return `+${digits}`;
}

export function normalizeZip(value: string): string {
  return digitsOnly(value);
}

/** Plates are stored upper case without a dash: `abc-1d23` -> `ABC1D23`. */
export function normalizePlate(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/** CPF or CNPJ without punctuation. CNPJ can carry letters since 2026. */
export function normalizeTaxId(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/** Parses a decimal typed in Brazilian or plain format: `1.250,50` and `1250.50` both give 1250.5. */
export function parseDecimal(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  let text = value.trim().replace(/\s/g, '');
  if (text.includes(',')) {
    text = text.replace(/\./g, '').replace(',', '.');
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}
