import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { normalizePhone, normalizePlate, normalizeTaxId, parseDecimal } from '../../core/util/normalizers';

function text(control: AbstractControl): string {
  return typeof control.value === 'string' ? control.value : '';
}

/** Not empty after trimming. `Validators.required` accepts a string of spaces. */
export const notBlank: ValidatorFn = (control) =>
  text(control).trim().length > 0 ? null : { required: true };

/** 8 to 128 characters with an upper case letter, a lower case letter and a digit (the API rule). */
export const strongPassword: ValidatorFn = (control) => {
  const value = text(control);
  const ok =
    value.length >= 8 && value.length <= 128 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
  return ok || value.length === 0 ? null : { strongPassword: true };
};

/** Brazilian phone, with or without country code. */
export const phone: ValidatorFn = (control) => {
  if (!text(control).trim()) {
    return null;
  }
  const digits = normalizePhone(text(control)).replace(/\D/g, '');
  return digits.length >= 12 && digits.length <= 15 ? null : { phone: true };
};

/** `ABC1234` or Mercosul `ABC1D23`. */
export const plate: ValidatorFn = (control) => {
  if (!text(control).trim()) {
    return null;
  }
  return /^[A-Z]{3}\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$/.test(normalizePlate(text(control))) ? null : { plate: true };
};

/** 8 digits, with or without the dash. */
export const zipCode: ValidatorFn = (control) => {
  if (!text(control).trim()) {
    return null;
  }
  return text(control).replace(/\D/g, '').length === 8 ? null : { zipCode: true };
};

/** CPF (11 digits) or CNPJ (14 characters, letters allowed). The API checks the digits. */
export const taxId: ValidatorFn = (control) => {
  if (!text(control).trim()) {
    return null;
  }
  const value = normalizeTaxId(text(control));
  const cpf = /^\d{11}$/.test(value);
  const cnpj = /^[A-Z0-9]{14}$/.test(value);
  return cpf || cnpj ? null : { taxId: true };
};

/** A number greater than `min` (default 0), typed in Brazilian or plain format. */
export function greaterThan(min = 0): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (raw === null || raw === undefined || raw === '') {
      return null;
    }
    const value = parseDecimal(raw);
    return value !== null && value > min ? null : { greaterThan: { min } };
  };
}

/** An http(s) address. */
export const webUrl: ValidatorFn = (control) => {
  if (!text(control).trim()) {
    return null;
  }
  try {
    const url = new URL(text(control).trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? null : { webUrl: true };
  } catch {
    return { webUrl: true };
  }
};
