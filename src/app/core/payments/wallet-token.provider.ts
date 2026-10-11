import { InjectionToken } from '@angular/core';

/** What the native shell hands the web app so Apple Pay can run: Mercado Pago's SDK lives in the native layer. */
export interface WalletToken {
  cardToken: string;
  /** Card network the token belongs to, such as `visa` or `master`. */
  paymentMethodId: string;
}

export interface WalletTokenProvider {
  /** False in a plain browser and on Android. */
  isAvailable(): boolean;
  /** Opens the Apple Pay sheet for `amount` (BRL). Resolves with `null` when the person closes it. */
  request(amount: number): Promise<WalletToken | null>;
}

interface NativeWallet {
  isAvailable?: () => boolean;
  tokenize: (amount: number) => Promise<WalletToken | null>;
}

declare global {
  interface Window {
    /** Injected by the iOS app (Capacitor plugin). Absent in the browser. */
    FrotaWallet?: NativeWallet;
  }
}

/** Reads `window.FrotaWallet`, which the iOS build provides. Until then Apple Pay stays off. */
export const WALLET_TOKEN_PROVIDER = new InjectionToken<WalletTokenProvider>('WALLET_TOKEN_PROVIDER', {
  providedIn: 'root',
  factory: () => ({
    isAvailable: () => {
      const native = typeof window === 'undefined' ? undefined : window.FrotaWallet;
      return !!native && (native.isAvailable?.() ?? true);
    },
    request: async (amount) => {
      const native = window.FrotaWallet;
      return native ? native.tokenize(amount) : null;
    },
  }),
});
