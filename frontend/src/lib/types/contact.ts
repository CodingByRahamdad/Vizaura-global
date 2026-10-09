/** Must stay in lockstep with backend/src/modules/contact/contact.validators.ts's CONTACT_SUBJECTS enum. */
export type ContactSubject = "general" | "product" | "order_support" | "wholesale" | "business";

export interface ContactPayload {
  fullName: string;
  email: string;
  phone?: string;
  subject: ContactSubject;
  message: string;
  acceptedTerms: boolean;
  captchaToken: string;
  /** Honeypot — always sent empty by real users; never shown to them. */
  website?: string;
}
