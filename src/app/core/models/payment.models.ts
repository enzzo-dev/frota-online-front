import { PaymentStatus } from './enums';

export type SubscriptionPlan = 'Basic' | 'Full';
export type SubscriptionStatus = 'Pending' | 'Active' | 'Cancelled';
export type FeeChargeStatus = 'Pending' | 'Paid' | 'Cancelled';

export interface PlanOption {
  plan: SubscriptionPlan;
  monthlyPrice: number;
  /** `null` means no limit. */
  maxVehicles: number | null;
}

export interface Subscription {
  id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  monthlyPrice: number;
  maxVehicles: number | null;
  /** True while the driver is inside a period they paid for. */
  hasAccess: boolean;
  startsAt: string | null;
  endsAt: string | null;
  /** Only present while the first charge is unpaid. */
  paymentUrl: string | null;
}

export interface SubscriptionOverview {
  plans: PlanOption[];
  current: Subscription | null;
}

export interface PayoutAccount {
  configured: boolean;
  walletId: string | null;
}

/** A Pix issued by the app: show `pixPayload` (copia e cola) and `pixQrCode` (base64 PNG). */
export interface PixPayment {
  paymentId: string;
  deliveryId: string;
  amount: number;
  driverReceives: number;
  platformFee: number;
  status: PaymentStatus;
  pixPayload: string;
  pixQrCode: string | null;
  expiresAt: string;
}

export interface FeeCharge {
  id: string;
  amount: number;
  status: FeeChargeStatus;
  pixPayload: string;
  pixQrCode: string | null;
  expiresAt: string;
}

export interface UploadUrl {
  storageKey: string;
  uploadUrl: string;
  method: string;
  headers: Record<string, string>;
  maxBytes: number;
  expiresAt: string;
}

export interface DownloadUrl {
  url: string;
  expiresAt: string;
}

/** What the customer types for a new card. Sent once to the API, never kept by the app. */
export interface CardInput {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface CardHolderInput {
  taxId: string;
  postalCode: string;
  addressNumber: string;
  phone: string | null;
}

/** A saved card (brand and last four digits only) or a new one, never both. */
export interface PayWithCardRequest {
  savedCardId?: string;
  card?: CardInput;
  holder?: CardHolderInput;
  saveCard: boolean;
}

export interface CardPayment {
  paymentId: string;
  deliveryId: string;
  amount: number;
  driverReceives: number;
  platformFee: number;
  status: PaymentStatus;
  brand: string | null;
  last4: string | null;
  cardSaved: boolean;
}

export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
}

export interface WalletPayment {
  paymentId: string;
  deliveryId: string;
  amount: number;
  driverReceives: number;
  platformFee: number;
  status: PaymentStatus;
  providerStatus: string;
}

export interface WalletAccount {
  connected: boolean;
}

export interface WalletAuthorization {
  authorizationUrl: string;
}
