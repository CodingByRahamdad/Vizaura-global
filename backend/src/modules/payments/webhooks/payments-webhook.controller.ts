import type { NextFunction, Request, Response } from "express";
import { PaymentsService } from "../payments.service.js";
import { paymentsErrors } from "../../../errors/AppError.js";

const paymentsService = new PaymentsService();

/// No req.auth here — this route is mounted outside authenticate/CSRF
/// entirely (see app.ts). Authentication is the provider's HMAC signature,
/// verified inside PaymentsService.processWebhook via the resolved
/// provider's handleWebhook(). Every outcome after a valid signature
/// responds 200 (see processWebhook's own doc comment) — a thrown
/// AppError here means the signature itself was invalid/missing or the
/// provider key is unknown, both real delivery-authenticity problems the
/// errorHandler correctly turns into a 400.
export async function handle(req: Request, res: Response, next: NextFunction) {
  try {
    const { provider } = req.params as { provider: string };
    if (!Buffer.isBuffer(req.body)) throw paymentsErrors.validation({ reason: "raw body required" });

    // Generic header name — each provider's handleWebhook() interprets it
    // according to its own signature scheme; the controller stays
    // provider-agnostic (mock.provider.ts is the only implementation today).
    const signatureHeader = req.get("X-Webhook-Signature") ?? undefined;
    await paymentsService.processWebhook(provider.toUpperCase(), req.body, signatureHeader);
    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
}
