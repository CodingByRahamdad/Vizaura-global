import { PaymentsRepository, type PaymentWithTransactions } from "./payments.repository.js";
import { OrdersRepository } from "../orders/orders.repository.js";
import { OrdersService } from "../orders/orders.service.js";
import { RbacService } from "../rbac/rbac.service.js";
import type { AuthorizationState } from "../rbac/rbac.repository.js";
import { resolveProvider } from "./providers/index.js";
import { paymentsErrors } from "../../errors/AppError.js";
import type { ListAdminPaymentsQuery } from "./payments.validators.js";

const TERMINAL_ORDER_STATUSES = new Set(["CANCELLED", "COMPLETED", "FAILED", "REFUNDED", "RETURNED"]);

export interface ListResult<T> {
  payments: T[];
  total: number;
}

export class PaymentsService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository = new PaymentsRepository(),
    private readonly ordersRepository: OrdersRepository = new OrdersRepository(),
    private readonly ordersService: OrdersService = new OrdersService(),
    private readonly rbacService: RbacService = new RbacService(),
  ) {}

  async listAdmin(query: ListAdminPaymentsQuery, skip: number, take: number) {
    return this.paymentsRepository.listAdmin(
      { status: query.status, provider: query.provider, orderId: query.orderId },
      skip,
      take,
    );
  }

  /// Ownership is resolved through the payment's parent Order (a Payment has
  /// no userId of its own) — same "never distinguish not-yours from
  /// doesn't-exist" posture Orders already established.
  async getById(paymentId: string, requesterId: string, authState: AuthorizationState): Promise<PaymentWithTransactions> {
    const payment = await this.paymentsRepository.findById(paymentId);
    if (!payment) throw paymentsErrors.notFound();

    const order = await this.ordersRepository.findById(payment.orderId);
    if (!order) throw paymentsErrors.notFound();

    const allowed = this.rbacService.authorizeOwnerOrPermission({
      resourceOwnerId: order.userId,
      requesterId,
      state: authState,
      overridePermission: "payments:read",
    });
    if (!allowed) throw paymentsErrors.notFound();

    return payment;
  }

  /// COD-only, staff action (route requires payments:update) — COD has no
  /// provider to call, so this is the sole way a COD payment ever reaches a
  /// terminal state. Rejects any other provider outright: MOCK/a future real
  /// provider must go through verify/webhook, never a manual override.
  async markPaid(paymentId: string, actorUserId: string): Promise<PaymentWithTransactions> {
    const payment = await this.requireCodPayment(paymentId);
    if (payment.status !== "PENDING") throw paymentsErrors.invalidStatusTransition(payment.status, "PAID");
    await this.assertOrderPayable(payment.orderId);

    const updated = await this.paymentsRepository.updateStatus(paymentId, "PENDING", "PAID", { paidAt: new Date() });
    if (!updated) throw paymentsErrors.statusConflict();

    await this.paymentsRepository.createTransaction({
      paymentId,
      type: "CAPTURE",
      status: "PAID",
      amount: payment.amount,
      metadata: { markedByUserId: actorUserId },
    });
    await this.ordersService.updatePaymentStatus(payment.orderId, "PAID");

    return this.paymentsRepository.findById(paymentId) as Promise<PaymentWithTransactions>;
  }

  async markFailed(paymentId: string, actorUserId: string, reason: string): Promise<PaymentWithTransactions> {
    const payment = await this.requireCodPayment(paymentId);
    if (payment.status !== "PENDING") throw paymentsErrors.invalidStatusTransition(payment.status, "FAILED");
    await this.assertOrderPayable(payment.orderId);

    const updated = await this.paymentsRepository.updateStatus(paymentId, "PENDING", "FAILED");
    if (!updated) throw paymentsErrors.statusConflict();

    await this.paymentsRepository.createTransaction({
      paymentId,
      type: "AUTHORIZATION",
      status: "FAILED",
      amount: payment.amount,
      metadata: { reason, markedByUserId: actorUserId },
    });
    await this.ordersService.updatePaymentStatus(payment.orderId, "FAILED");

    return this.paymentsRepository.findById(paymentId) as Promise<PaymentWithTransactions>;
  }

  /// Idempotent: a repeat request against an already-fully-REFUNDED payment
  /// is a no-op, not a second refund. Rejects any amount exceeding what's
  /// still captured (payment.amount minus everything already refunded).
  /// The decision (remaining-amount computation, over-refund check) and the
  /// provider call itself happen inside refundLocked's row lock, so two
  /// concurrent refund requests against the same payment can never both pass
  /// the over-refund check and both call the provider — the second waits for
  /// the lock and then re-reads the already-updated remaining amount.
  async refund(
    paymentId: string,
    amountOverride: number | undefined,
    returnId?: string,
  ): Promise<PaymentWithTransactions> {
    const outcome = await this.paymentsRepository.refundLocked(
      paymentId,
      amountOverride,
      async (payment, requestedAmount) => {
        const provider = resolveProvider(payment.provider);
        return provider.refundPayment({
          paymentId,
          providerPaymentId: payment.providerPaymentId,
          amount: requestedAmount,
        });
      },
      { source: "GATEWAY_REFUND", returnId: returnId ?? null },
    );

    switch (outcome.kind) {
      case "not-found":
        throw paymentsErrors.notFound();
      case "already-refunded":
        return outcome.payment;
      case "invalid-status":
        throw paymentsErrors.invalidStatusTransition(outcome.payment.status, "REFUNDED");
      case "exceeds-captured":
        throw paymentsErrors.refundExceedsCaptured();
      case "applied":
        await this.ordersService.updatePaymentStatus(outcome.payment.orderId, outcome.newStatus);
        return outcome.payment;
    }
  }

  /// COD's necessary complement to refund() — mirrors markPaid/markFailed's
  /// precedent exactly (COD-only, no provider to call, a staff-attested
  /// manual write instead). Reuses refundLocked as-is (same row lock, same
  /// remaining-amount/over-refund check, same PaymentTransaction write) by
  /// passing a synthetic callProvider that records the staff-supplied
  /// reference instead of calling out — not a second refund implementation,
  /// just COD's substitute for the provider call refundLocked always makes.
  async markRefunded(
    paymentId: string,
    actorUserId: string,
    amountOverride: number | undefined,
    reference: string | undefined,
    returnId?: string,
  ): Promise<PaymentWithTransactions> {
    await this.requireCodPayment(paymentId);

    const outcome = await this.paymentsRepository.refundLocked(
      paymentId,
      amountOverride,
      async () => ({
        status: "REFUNDED" as const,
        providerReference: reference ?? `staff:${actorUserId}`,
      }),
      { source: "COD_ATTESTATION", returnId: returnId ?? null, actorUserId },
    );

    switch (outcome.kind) {
      case "not-found":
        throw paymentsErrors.notFound();
      case "already-refunded":
        return outcome.payment;
      case "invalid-status":
        throw paymentsErrors.invalidStatusTransition(outcome.payment.status, "REFUNDED");
      case "exceeds-captured":
        throw paymentsErrors.refundExceedsCaptured();
      case "applied":
        await this.ordersService.updatePaymentStatus(outcome.payment.orderId, outcome.newStatus);
        return outcome.payment;
    }
  }

  /// The full verify → check idempotency → find payment → validate → update
  /// payment → update order sequence (docs/modules/PAYMENTS.md). Every
  /// outcome after a valid signature responds normally (never throws) so
  /// the caller (the webhook controller) can always answer 200 — a
  /// signature failure is the sole case that propagates as an error (400),
  /// since a legitimate provider should not blindly retry a signature it
  /// computed wrong.
  async processWebhook(providerKey: string, rawBody: Buffer, signatureHeader: string | undefined): Promise<void> {
    const provider = resolveProvider(providerKey);
    const event = provider.handleWebhook(rawBody, signatureHeader); // throws on bad signature — propagates as 400

    // Payment/order lookup happens before the event is durably recorded, so
    // the "found and valid" path below can record the event and apply the
    // resulting Payment/PaymentTransaction mutation as a single transaction
    // (applyWebhookEvent) — a crash between the two can no longer leave the
    // event marked "received" with its state change never applied. For the
    // unmatched/mismatched paths there's no further state to keep atomic
    // with the event record, so it's recorded standalone.
    const payment = await this.paymentsRepository.findByProviderPaymentId(providerKey, event.providerPaymentId);
    if (!payment) {
      await this.paymentsRepository.recordWebhookEventStandalone(providerKey, event.eventId);
      console.warn(`payments webhook: no payment found for ${providerKey}:${event.providerPaymentId}`);
      return;
    }

    const order = await this.ordersRepository.findById(payment.orderId);
    if (
      !order ||
      TERMINAL_ORDER_STATUSES.has(order.status) ||
      event.amount !== payment.amount ||
      event.currencyCode !== payment.currencyCode
    ) {
      await this.paymentsRepository.recordWebhookEventStandalone(providerKey, event.eventId);
      console.warn(`payments webhook: rejected mismatch for payment ${payment.id}`);
      return;
    }

    const outcome = await this.paymentsRepository.applyWebhookEvent({
      provider: providerKey,
      eventId: event.eventId,
      paymentId: payment.id,
      expectedCurrentStatus: payment.status,
      newStatus: event.status,
      providerPaymentId: event.providerPaymentId,
      paidAt: event.status === "PAID" ? new Date() : undefined,
      transaction: {
        type: event.type,
        status: event.status,
        amount: event.amount,
        providerReference: event.eventId,
        metadata: event.raw as never,
      },
    });

    if (outcome.kind === "duplicate") {
      // Already durably processed by an earlier delivery of this exact
      // eventId — also covers retry-after-timeout. Nothing further to do.
      return;
    }

    if (outcome.kind === "lost-race") {
      // Lost the guarded-update race — a concurrent event already moved
      // this payment. If it already landed on the same status this event
      // wanted, that's a no-op success (duplicate/out-of-order delivery);
      // otherwise it's a genuine conflicting-state race — log and stop
      // rather than last-writer-wins over the guarded winner. The event row
      // was still recorded (inside the same transaction) so a resend of
      // this exact eventId won't be reprocessed either.
      const current = await this.paymentsRepository.findById(payment.id);
      if (current?.status !== event.status) {
        console.warn(`payments webhook: lost race on payment ${payment.id}, event ${event.eventId} not applied`);
      }
      return;
    }

    await this.ordersService.updatePaymentStatus(payment.orderId, event.status);
  }

  /// COD and MANUAL (admin-entered offline orders, see orders.repository.ts
  /// createAdminOrder) are the only providers with no gateway to call —
  /// both are staff-attested terminal-state writes. MOCK/a future real
  /// provider must still go through verify/webhook, never this manual path.
  private async requireCodPayment(paymentId: string): Promise<PaymentWithTransactions> {
    const payment = await this.paymentsRepository.findById(paymentId);
    if (!payment) throw paymentsErrors.notFound();
    if (payment.provider !== "COD" && payment.provider !== "MANUAL") {
      throw paymentsErrors.staffActionNotSupported(payment.provider);
    }
    return payment;
  }

  /// Guards the staff mark-paid/mark-failed actions the same way the webhook
  /// path already guards itself (TERMINAL_ORDER_STATUSES) — without this, a
  /// COD payment left PENDING on an order that was separately cancelled or
  /// completed could still be marked paid/failed by staff, producing an
  /// inconsistent Order.status/paymentStatus combination.
  private async assertOrderPayable(orderId: string): Promise<void> {
    const order = await this.ordersRepository.findById(orderId);
    if (!order || TERMINAL_ORDER_STATUSES.has(order.status)) {
      throw paymentsErrors.orderNotPayable(order?.status ?? "UNKNOWN");
    }
  }
}
