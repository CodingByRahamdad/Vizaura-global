import type { PrismaClient, Shipment, ShipmentStatus } from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";

export interface AdminShipmentFilters {
  status?: ShipmentStatus;
  orderId?: string;
}

const listOrderBy = [{ createdAt: "desc" as const }, { id: "desc" as const }];

export class ShipmentsRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async findById(id: string): Promise<Shipment | null> {
    return this.prisma.shipment.findUnique({ where: { id } });
  }

  async findByOrderId(orderId: string): Promise<Shipment | null> {
    return this.prisma.shipment.findUnique({ where: { orderId } });
  }

  async listAdmin(
    filters: AdminShipmentFilters,
    skip: number,
    take: number,
  ): Promise<{ shipments: Shipment[]; total: number }> {
    const where = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.orderId ? { orderId: filters.orderId } : {}),
    };

    const [shipments, total] = await Promise.all([
      this.prisma.shipment.findMany({ where, orderBy: listOrderBy, skip, take }),
      this.prisma.shipment.count({ where }),
    ]);
    return { shipments, total };
  }

  /// Guarded UPDATE — same template as PaymentsRepository.updateStatus /
  /// OrdersRepository.transitionStatus. Returns `null` on 0 rows (a
  /// concurrent request already moved this shipment); the caller (409 for
  /// the HTTP caller) decides what that means. No related history-row
  /// insert exists for Shipment (unlike Payment/Order), so this is a single
  /// statement, not a $transaction — nothing else needs to commit alongside
  /// it.
  async transitionStatus(params: {
    shipmentId: string;
    expectedCurrentStatus: ShipmentStatus;
    newStatus: ShipmentStatus;
    trackingNumber?: string;
    carrier?: string;
  }): Promise<Shipment | null> {
    const shippedAt = params.newStatus === "SHIPPED" ? new Date() : null;
    const deliveredAt = params.newStatus === "DELIVERED" ? new Date() : null;

    const guarded = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE shipments SET
        status = ${params.newStatus}::"ShipmentStatus",
        "trackingNumber" = COALESCE(${params.trackingNumber ?? null}, "trackingNumber"),
        carrier = COALESCE(${params.carrier ?? null}, carrier),
        "shippedAt" = COALESCE(${shippedAt}::timestamp, "shippedAt"),
        "deliveredAt" = COALESCE(${deliveredAt}::timestamp, "deliveredAt"),
        "updatedAt" = now()
      WHERE id = ${params.shipmentId}::uuid AND status = ${params.expectedCurrentStatus}::"ShipmentStatus"
      RETURNING id
    `;
    if (guarded.length === 0) return null;
    return this.prisma.shipment.findUniqueOrThrow({ where: { id: params.shipmentId } });
  }
}
