import { signal } from '@angular/core';
import { ApiError } from '../http/api-error';

/**
 * Loading and error state for one kind of request on a screen.
 * `run` resolves to the value, or to `undefined` when the call failed (the error is then in `error`).
 */
export function createRequestState() {
  const loading = signal(false);
  const error = signal<ApiError | null>(null);

  async function run<T>(work: () => Promise<T>): Promise<T | undefined> {
    loading.set(true);
    error.set(null);
    try {
      return await work();
    } catch (caught) {
      error.set(ApiError.from(caught));
      return undefined;
    } finally {
      loading.set(false);
    }
  }

  return {
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    run,
    clearError: () => error.set(null),
  };
}

export type RequestState = ReturnType<typeof createRequestState>;
