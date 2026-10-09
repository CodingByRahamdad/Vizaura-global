import type { PrismaClient } from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";

export interface AuthorizationState {
  roleKeys: string[];
  permissionKeys: string[];
}

export class RbacRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  /// Loads a user's active-role permission set fresh from the database.
  /// Roles with `isActive = false` contribute no permissions, so deactivating
  /// a role takes effect on the very next request.
  async loadAuthorizationState(userId: string): Promise<AuthorizationState> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId, role: { isActive: true } },
      select: {
        role: {
          select: {
            key: true,
            permissions: {
              select: { permission: { select: { key: true } } },
            },
          },
        },
      },
    });

    const roleKeys = new Set<string>();
    const permissionKeys = new Set<string>();

    for (const { role } of userRoles) {
      roleKeys.add(role.key);
      for (const { permission } of role.permissions) {
        permissionKeys.add(permission.key);
      }
    }

    return { roleKeys: [...roleKeys], permissionKeys: [...permissionKeys] };
  }

  async findRoleByKey(key: string) {
    return this.prisma.role.findUnique({ where: { key } });
  }

  async countSuperAdminAssignments(excludingUserId?: string): Promise<number> {
    return this.prisma.userRole.count({
      where: {
        role: { key: "super_admin" },
        ...(excludingUserId ? { userId: { not: excludingUserId } } : {}),
      },
    });
  }

  /// Same shape as countSuperAdminAssignments but scoped to users who can
  /// currently act (not SUSPENDED/DEACTIVATED) — used to guard suspension,
  /// unlike role-removal, which cares about the role assignment existing at
  /// all regardless of current status. Deliberately NOT `status: "ACTIVE"`
  /// only: PENDING_VERIFICATION doesn't block an already-authenticated staff
  /// session (see middleware/authenticate.ts), so a PENDING_VERIFICATION
  /// super_admin still counts as "able to act."
  async countActiveSuperAdminAssignments(excludingUserId?: string): Promise<number> {
    return this.prisma.userRole.count({
      where: {
        role: { key: "super_admin" },
        user: { status: { notIn: ["SUSPENDED", "DEACTIVATED"] } },
        ...(excludingUserId ? { userId: { not: excludingUserId } } : {}),
      },
    });
  }
}
