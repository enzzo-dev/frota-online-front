import { InjectionToken } from '@angular/core';

/** Root of the versioned API, for example `/api/v1`. Provided from the environment. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
