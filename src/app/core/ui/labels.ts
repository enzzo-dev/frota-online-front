import {
  DeliveryStatus,
  DriverStatus,
  FreightStatus,
  MediaKind,
  ProposalStatus,
  StopType,
  TermType,
  UserRole,
  VehicleType,
} from '../models';

/** How a status is drawn: its label and the chip tone (see `.chip` in the global styles). */
export type ChipTone = 'black' | 'red' | 'deep' | 'outline' | 'muted';

export interface StatusView {
  readonly label: string;
  readonly tone: ChipTone;
}

export const VEHICLE_TYPE_LABEL: Readonly<Record<VehicleType, string>> = {
  Fiorino: 'Fiorino',
  Van: 'Van',
  Pickup: 'Picape',
  Truck34: 'Caminhão 3/4',
  Truck: 'Caminhão',
  Trailer: 'Carreta',
};

export const STOP_TYPE_LABEL: Readonly<Record<StopType, string>> = {
  Pickup: 'Coleta',
  Delivery: 'Entrega',
};

export const USER_ROLE_LABEL: Readonly<Record<UserRole, string>> = {
  Customer: 'Cliente',
  Driver: 'Motorista',
  Admin: 'Administrador',
};

export const TERM_TYPE_LABEL: Readonly<Record<TermType, string>> = {
  TermsOfUse: 'Termos de uso',
  PrivacyPolicy: 'Política de privacidade',
};

export const MEDIA_KIND_LABEL: Readonly<Record<MediaKind, string>> = {
  DriverDocument: 'Documento (CNH)',
  VehiclePhoto: 'Foto do veículo',
  CargoPhoto: 'Foto da carga',
  DeliveryProof: 'Comprovante de entrega',
};

export const FREIGHT_STATUS_VIEW: Readonly<Record<FreightStatus, StatusView>> = {
  Open: { label: 'Aberto', tone: 'outline' },
  Approved: { label: 'Aprovado', tone: 'red' },
  Expired: { label: 'Expirado', tone: 'muted' },
  Cancelled: { label: 'Cancelado', tone: 'muted' },
};

export const PROPOSAL_STATUS_VIEW: Readonly<Record<ProposalStatus, StatusView>> = {
  Pending: { label: 'Pendente', tone: 'outline' },
  Accepted: { label: 'Aceita', tone: 'red' },
  Rejected: { label: 'Recusada', tone: 'muted' },
  Expired: { label: 'Expirada', tone: 'muted' },
  Withdrawn: { label: 'Retirada', tone: 'muted' },
};

export const DRIVER_STATUS_VIEW: Readonly<Record<DriverStatus, StatusView>> = {
  Draft: { label: 'Rascunho', tone: 'outline' },
  PendingReview: { label: 'Em análise', tone: 'black' },
  Approved: { label: 'Aprovado', tone: 'red' },
  Rejected: { label: 'Recusado', tone: 'deep' },
  Removed: { label: 'Conta excluída', tone: 'muted' },
};

export const DELIVERY_STATUS_VIEW: Readonly<Record<DeliveryStatus, StatusView>> = {
  Scheduled: { label: 'Agendada', tone: 'outline' },
  ToPickup: { label: 'A caminho da coleta', tone: 'black' },
  PickedUp: { label: 'Coletada', tone: 'black' },
  InTransit: { label: 'Em trânsito', tone: 'black' },
  Delivered: { label: 'Entregue', tone: 'red' },
  Cancelled: { label: 'Cancelada', tone: 'muted' },
  Incident: { label: 'Ocorrência', tone: 'deep' },
};

/** Brazilian states (UF), for the address form. */
export const BRAZILIAN_STATES: readonly string[] = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export const CNH_CATEGORIES: readonly string[] = ['A', 'B', 'AB', 'C', 'D', 'E', 'AC', 'AD', 'AE'];
