import type { Prisma, PrismaClient, User, UserStatus } from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";

export type { User } from "../../generated/prisma/client.js";

export interface AdminUserFilter {
  search?: string;
  status?: UserStatus;
  /// A role KEY ("customer" | "super_admin"), not a role id — the caller
  /// resolves this the same way requirePermission does, never a raw string.
  roleKey?: string;
  skip: number;
  take: number;
}

/// List rows include only the role KEY, not the role's full permission set —
/// loading every row's complete permission graph would be pure waste for a
/// list (see docs/modules/USERS.md's N+1/over-fetch note). The detail view
/// resolves real permissions separately, once, via RbacRepository.
export interface AdminUserListRow extends User {
  roles: { role: { key: string } }[];
}

export interface AdminUserDetailRow extends User {
  roles: { role: { key: string; name: string } }[];
}

export class UsersRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  /// Includes soft-deleted users deliberately: registration must be able to
  /// see them to enforce the account-recreation policy (auth.service.ts).
  async findByEmailIncludingDeleted(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /// Excludes soft-deleted users — the normal lookup for login/sessions.
  async findActiveById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user && user.deletedAt === null ? user : null;
  }

  async findActiveByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user && user.deletedAt === null ? user : null;
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }

  /// All active customer-role user ids — used by the admin promotion
  /// broadcast action to fan out one CustomerNotification per customer.
  /// Selects only `id` to avoid hydrating full rows for what's purely an
  /// id list.
  async listAllCustomerIds(): Promise<string[]> {
    const rows = await this.prisma.user.findMany({
      where: { deletedAt: null, roles: { some: { role: { key: "customer" } } } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  /// Admin cross-account list (Phase 6J) — excludes soft-deleted accounts
  /// (no account-deletion feature exists, but the column is defensively
  /// respected everywhere else in this codebase). Search matches
  /// email/firstName/lastName, same OR-contains shape Orders' own admin
  /// search uses.
  async listAdmin(filter: AdminUserFilter): Promise<{ rows: AdminUserListRow[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.roleKey ? { roles: { some: { role: { key: filter.roleKey } } } } : {}),
      ...(filter.search
        ? {
            OR: [
              { email: { contains: filter.search, mode: "insensitive" } },
              { firstName: { contains: filter.search, mode: "insensitive" } },
              { lastName: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: { createdAt: "desc" },
        include: { roles: { select: { role: { select: { key: true } } } } },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { rows, total };
  }

  async findAdminDetailById(id: string): Promise<AdminUserDetailRow | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { roles: { select: { role: { select: { key: true, name: true } } } } },
    });
  }

  async updateStatus(id: string, status: UserStatus): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { status } });
  }

  async updateFields(
    id: string,
    fields: Partial<
      Pick<
        User,
        "firstName" | "lastName" | "email" | "phone" | "addressLine1" | "addressLine2" | "city" | "region" | "postalCode" | "countryCode"
      >
    >,
  ): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: fields });
  }

  /// Soft delete — sets deletedAt, used when the customer has order history.
  /// See UsersService.deleteCustomer's doc comment for the hard/soft branch.
  async softDelete(id: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /// Real row delete — only ever safe to call once the caller has confirmed
  /// zero orders exist (Order.userId is onDelete: Restrict; every other
  /// relation on User is Cascade/SetNull).
  async hardDelete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  /// Swaps the user's single role assignment (customer<->super_admin are
  /// mutually exclusive in this system) in one transaction. Resolving the
  /// target Role row is the caller's job (RbacRepository.findRoleByKey) —
  /// this only ever writes a role id it was handed, never a raw key.
  async replaceRole(userId: string, newRoleId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.userRole.create({ data: { userId, roleId: newRoleId } }),
    ]);
  }
}
