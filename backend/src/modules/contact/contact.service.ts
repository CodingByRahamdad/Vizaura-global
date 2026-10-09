import { env } from "../../config/env.js";
import { getEmailProvider } from "../../integrations/email/index.js";
import { contactErrors } from "../../errors/AppError.js";
import { ContactRepository } from "./contact.repository.js";
import type { ContactInput } from "./contact.validators.js";

const SALES_SUBJECTS = new Set(["wholesale", "business"]);

/// Never trust a client-supplied recipient — the subject enum (already
/// constrained by contactSchema) is the only input to this decision.
function resolveRecipient(subject: string): string {
  return SALES_SUBJECTS.has(subject) ? env.contact.salesEmail : env.contact.infoEmail;
}

/// Minimal HTML escaping for interpolation into the email template. No user
/// string is ever inserted into the template unescaped.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export class ContactService {
  constructor(
    private readonly contactRepository: ContactRepository = new ContactRepository(),
  ) {}

  async submit(input: ContactInput): Promise<void> {
    // Persist first: the submission must survive even if the email provider
    // later fails, so nothing a customer wrote is ever silently lost.
    await this.contactRepository.create({
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      subject: input.subject,
      message: input.message,
    });

    const to = resolveRecipient(input.subject);

    try {
      await getEmailProvider().sendContactMessage({
        to,
        replyTo: input.email,
        fullName: escapeHtml(input.fullName),
        phone: input.phone ? escapeHtml(input.phone) : undefined,
        subject: input.subject,
        message: escapeHtml(input.message),
      });
    } catch (error) {
      throw contactErrors.sendFailed({
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}
