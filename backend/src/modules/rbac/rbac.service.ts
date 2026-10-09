import { RbacRepository, type AuthorizationState } from "./rbac.repository.js";

/// Backend-authoritative RBAC. There is no `role === "admin"` branch anywhere
/// in this codebase — every check is a permission-set membership test against
/// state loaded fresh from the database for this request.
export class RbacService {
  constructor(private readonly repository: RbacRepository = new RbacRepository()) {}

  async getAuthorizationState(userId: string): Promise<AuthorizationState> {
    return this.repository.loadAuthorizationState(userId);
  }

  hasPermission(state: AuthorizationState, permissionKey: string): boolean {
    return state.permissionKeys.includes(permissionKey);
  }

  hasAllPermissions(state: AuthorizationState, permissionKeys: string[]): boolean {
    return permissionKeys.every((key) => state.permissionKeys.includes(key));
  }

  hasAnyPermission(state: AuthorizationState, permissionKeys: string[]): boolean {
    return permissionKeys.some((key) => state.permissionKeys.includes(key));
  }

  /// A caller owns a resource, OR holds the given override permission (e.g. a
  /// customer reading their own order vs. an Order Manager reading any order).
  /// Ownership is intentionally not expressible as role/permission middleware
  /// — it depends on the loaded resource, so services call this directly.
  authorizeOwnerOrPermission(params: {
    /// null for a resource with no owner (e.g. a guest/no-account order) —
    /// never equals a real requesterId, so it always falls through to the
    /// override-permission check, making such a resource staff-only reachable.
    resourceOwnerId: string | null;
    requesterId: string;
    state: AuthorizationState;
    overridePermission: string;
  }): boolean {
    if (params.resourceOwnerId === params.requesterId) return true;
    return this.hasPermission(params.state, params.overridePermission);
  }

  /// Guards against removing the last super_admin assignment, and against a
  /// user stripping their own super_admin role.
  async canRemoveSuperAdmin(userId: string): Promise<boolean> {
    const remainingOthers = await this.repository.countSuperAdminAssignments(userId);
    return remainingOthers > 0;
  }

  /// Guards against suspending the last ACTIVE super_admin, leaving nobody
  /// able to act. See RbacRepository.countActiveSuperAdminAssignments.
  async canSuspendUser(userId: string): Promise<boolean> {
    const remainingActiveOthers = await this.repository.countActiveSuperAdminAssignments(userId);
    return remainingActiveOthers > 0;
  }
}
