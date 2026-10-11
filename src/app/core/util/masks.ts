/** Display masks for fields typed by hand. The API still receives clean values (see normalizers.ts). */

/** `11999998888` -> `(11) 99999-8888`; landlines (10 digits) -> `(11) 9999-8888`. Keeps at most 11 digits. */
export function maskPhone(value: string): string {
  let d = value.replace(/\D/g, '');
  // A pasted number with the country code (+55) loses it: the field is national.
  if (d.length > 11 && d.startsWith('55')) {
    d = d.slice(2);
  }
  d = d.slice(0, 11);
  if (d.length === 0) {
    return '';
  }
  if (d.length <= 2) {
    return `(${d}`;
  }
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (d.length <= 6) {
    return `(${ddd}) ${rest}`;
  }
  const cut = d.length > 10 ? 5 : 4;
  return `(${ddd}) ${rest.slice(0, cut)}-${rest.slice(cut)}`;
}

/**
 * CPF while the value is up to 11 digits (`000.000.000-00`), CNPJ once it grows past that or carries a letter
 * (`AA.AAA.AAA/AAAA-00`, letters allowed since 2026).
 */
export function maskTaxId(value: string): string {
  const raw = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const isCpf = raw.length <= 11 && /^\d*$/.test(raw);
  if (isCpf) {
    const p = [raw.slice(0, 3), raw.slice(3, 6), raw.slice(6, 9), raw.slice(9, 11)];
    return [p[0], p[1] && `.${p[1]}`, p[2] && `.${p[2]}`, p[3] && `-${p[3]}`].filter(Boolean).join('');
  }
  const c = raw.slice(0, 14);
  const p = [c.slice(0, 2), c.slice(2, 5), c.slice(5, 8), c.slice(8, 12), c.slice(12, 14)];
  return [p[0], p[1] && `.${p[1]}`, p[2] && `.${p[2]}`, p[3] && `/${p[3]}`, p[4] && `-${p[4]}`]
    .filter(Boolean)
    .join('');
}

/** `01310100` -> `01310-100`. */
export function maskZip(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
