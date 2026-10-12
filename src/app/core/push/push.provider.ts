import { InjectionToken } from '@angular/core';
import { DevicePlatform } from '../models';

/** What the native shell hands the web app so push can work: the Firebase token lives in the native layer. */
export interface PushRegistration {
  token: string;
  platform: DevicePlatform;
}

export interface PushProvider {
  /** False in a plain browser, until the native shell provides push. */
  isAvailable(): boolean;
  /** Asks permission when needed and returns the FCM token, or `null` when the person says no. */
  register(): Promise<PushRegistration | null>;
  /** Calls `listener` whenever a push arrives or is tapped. Returns a function that stops listening. */
  onPush(listener: () => void): () => void;
}

interface NativePush {
  register: () => Promise<PushRegistration | null>;
  onPush: (listener: () => void) => () => void;
}

declare global {
  interface Window {
    /** Injected by the native app (Capacitor push plugin wrapper). Absent in the browser. */
    FrotaPush?: NativePush;
  }
}

/** Reads `window.FrotaPush`, which the native build provides. Until then the app falls back to polling. */
export const PUSH_PROVIDER = new InjectionToken<PushProvider>('PUSH_PROVIDER', {
  providedIn: 'root',
  factory: () => ({
    isAvailable: () => typeof window !== 'undefined' && !!window.FrotaPush,
    register: async () => (window.FrotaPush ? window.FrotaPush.register() : null),
    onPush: (listener) => (window.FrotaPush ? window.FrotaPush.onPush(listener) : () => undefined),
  }),
});
