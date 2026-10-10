import { TermType } from './enums';

export interface Term {
  id: string;
  type: TermType;
  version: string;
  title: string;
  contentUrl: string;
  publishedAt?: string;
}

export interface Consent {
  termDocumentId: string;
  type: TermType;
  version: string;
  acceptedAt: string;
}

export interface PublishTermRequest {
  type: TermType;
  version: string;
  title: string;
  contentUrl: string;
}
