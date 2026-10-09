import { env } from "../../config/env.js";
import type { EmailProvider } from "./email.types.js";
import { ConsoleEmailProvider } from "./console.provider.js";
import { BrevoEmailProvider } from "./brevo.provider.js";

export type { EmailProvider } from "./email.types.js";

let provider: EmailProvider | undefined;

export function getEmailProvider(): EmailProvider {
  if (!provider) {
    provider = env.email.provider === "brevo" ? new BrevoEmailProvider() : new ConsoleEmailProvider();
  }
  return provider;
}
