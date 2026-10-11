import { HttpErrorResponse } from '@angular/common/http';
import { ERROR_MESSAGES, GENERIC_ERROR_MESSAGE } from './error-messages';

/** Shape of the problem details JSON the API sends on failure. */
interface ProblemBody {
  title?: unknown;
  detail?: unknown;
  status?: unknown;
  errors?: unknown;
}

const CODE_PATTERN = /^[a-z_]+(\.[a-z_]+)*$/;

/**
 * A failed API call in a form the UI can branch on.
 * `code` is the stable `title` from the API (for example `auth.email_in_use`), or a generic code
 * derived from the status when the API sent none.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors: Readonly<Record<string, readonly string[]>> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }

  /** Every field message from a 400 validation response, flattened. */
  get fieldMessages(): string[] {
    return Object.values(this.fieldErrors).flat();
  }

  static is(value: unknown): value is ApiError {
    return value instanceof ApiError;
  }

  static from(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error;
    }
    if (error instanceof HttpErrorResponse) {
      return ApiError.fromHttp(error);
    }
    return new ApiError(-1, 'unknown', GENERIC_ERROR_MESSAGE);
  }

  private static fromHttp(error: HttpErrorResponse): ApiError {
    if (error.status === 0) {
      return new ApiError(0, 'network_error', ERROR_MESSAGES['network_error'] ?? GENERIC_ERROR_MESSAGE);
    }

    const body = isRecord(error.error) ? (error.error as ProblemBody) : null;
    const fieldErrors = parseFieldErrors(body?.errors);
    const hasFieldErrors = Object.keys(fieldErrors).length > 0;
    const title = typeof body?.title === 'string' ? body.title : null;
    const detail = typeof body?.detail === 'string' ? body.detail : null;

    let code: string;
    if (hasFieldErrors) {
      code = 'validation_error';
    } else if (title !== null && CODE_PATTERN.test(title)) {
      code = title;
    } else {
      code = codeFromStatus(error.status);
    }

    // The server's text names the addresses involved, so it beats the generic one for these codes.
    const message = (DETAIL_FIRST.has(code) ? detail : null) ?? ERROR_MESSAGES[code] ?? detail ?? GENERIC_ERROR_MESSAGE;
    return new ApiError(error.status, code, message, fieldErrors);
  }
}

const DETAIL_FIRST: ReadonlySet<string> = new Set(['route.missing_coordinates']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseFieldErrors(value: unknown): Record<string, string[]> {
  if (!isRecord(value)) {
    return {};
  }
  const result: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(value)) {
    if (Array.isArray(messages)) {
      const list = messages.filter((m): m is string => typeof m === 'string');
      if (list.length > 0) {
        result[field] = list;
      }
    }
  }
  return result;
}

function codeFromStatus(status: number): string {
  switch (status) {
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    default:
      return status >= 500 ? 'server_error' : 'unknown';
  }
}
