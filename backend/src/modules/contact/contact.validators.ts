import { z } from "zod";

export const CONTACT_SUBJECTS = ["general", "product", "order_support", "wholesale", "business"] as const;

export const contactSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional(),
  subject: z.enum(CONTACT_SUBJECTS),
  message: z.string().trim().min(10).max(2000),
  acceptedTerms: z.literal(true),
  captchaToken: z.string().min(1),
  // Honeypot: a real visitor never sees or fills this field (hidden in the
  // form). No length constraint here on purpose — contact.controller.ts
  // checks this value and silently fakes a success for any non-empty input
  // without sending/persisting; a validation error here would instead tell a
  // bot exactly which field tripped the trap.
  website: z.string().optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;
