import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { API_BASE_URL } from './core/config/api-base-url.token';
import { apiErrorInterceptor, authInterceptor } from './core/http/interceptors';
import { registerIcons } from './core/ui/icons';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // The error mapper wraps the auth interceptor, so it sees the final error after a token renewal.
    provideHttpClient(withFetch(), withInterceptors([apiErrorInterceptor, authInterceptor])),
    // One look on every platform (the design is custom), and modal props set signal inputs.
    provideIonicAngular({ mode: 'md', useSetInputAPI: true }),
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    provideAppInitializer(() => registerIcons()),
  ],
};
