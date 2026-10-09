import type { UserStatus } from "../../generated/prisma/client.js";
import { UsersRepository, type AdminUserDetailRow, type AdminUserListRow } from "./users.repository.js";
import { RbacRepository } from "../rbac/rbac.repository.js";
import { RbacService } from "../rbac/rbac.service.js";
import { AuthRepository } from "../auth/auth.repository.js";
import { AuthService } from "../auth/auth.service.js";
import { OrdersService } from "../orders/orders.service.js";
import type { PublicUser } from "./users.mapper.js";
import { usersErrors } from "../../errors/AppError.js";
import type {
  ListAdminUsersQuery,
  ListAdminCustomersQuery,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "./users.validators.js";

const CUSTOMER_ROLE_KEY = "customer";

type CustomerStats = { orderCount: number; totalSpent: { currencyCode: string; amount: number }[] };

// A user can be suspended from ACTIVE or PENDING_VERIFICATION (e.g. a
// spam/malicious signup, before they ever verify email), and reactivated
// only from SUSPENDED back to ACTIVE. DEACTIVATED is never a valid target or
// source here — no account-deletion/deactivation feature exists and none is
// invented. See docs/modules/USERS.md.
const SUSPENDABLE_FROM: UserStatus[] = ["ACTIVE", "PENDING_VERIFICATION"];

export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository = new UsersRepository(),
    private readonly rbacRepository: RbacRepository = new RbacRepository(),
    private readonly rbacService: RbacService = new RbacService(),
    private readonly authRepository: AuthRepository = new AuthRepository(),
    private readonly authService: AuthService = new AuthService(),
    private readonly ordersService: OrdersService = new OrdersService(),
  ) {}

  async listAdmin(
    query: ListAdminUsersQuery,
    skip: number,
    take: number,
  ): Promise<{ rows: AdminUserListRow[]; total: number }> {
    return this.usersRepository.listAdmin({
      search: query.search,
      status: query.status,
      roleKey: query.role,
      skip,
      take,
    });
  }

  async getDetail(id: string): Promise<{ row: AdminUserDetailRow; permissions: string[] }> {
    const row = await this.getExistingOrThrow(id);
    const { permissionKeys } = await this.rbacRepository.loadAuthorizationState(id);
    return { row, permissions: permissionKeys };
  }

  async updateStatus(
    id: string,
    actorUserId: string,
    newStatus: UserStatus,
  ): Promise<{ row: AdminUserDetailRow; permissions: string[] }> {
    if (id === actorUserId) throw usersErrors.cannotModifySelf();

    const target = await this.getExistingOrThrow(id);
    const isValidTransition =
      (newStatus === "SUSPENDED" && SUSPENDABLE_FROM.includes(target.status)) ||
      (newStatus === "ACTIVE" && target.status === "SUSPENDED");
    if (!isValidTransition) {
      throw usersErrors.invalidStatusTransition(target.status, newStatus);
    }

    if (newStatus === "SUSPENDED" && this.roleKeyOf(target) === "super_admin") {
      const canSuspend = await this.rbacService.canSuspendUser(id);
      if (!canSuspend) throw usersErrors.lastSuperAdmin();
    }

    await this.usersRepository.updateStatus(id, newStatus);
    if (newStatus === "SUSPENDED") {
      await this.authRepository.revokeAllSessionsForUser(id, "admin_suspended");
    }

    return this.getDetail(id);
  }

  async updateRole(
    id: string,
    actorUserId: string,
    newRoleKey: string,
  ): Promise<{ row: AdminUserDetailRow; permissions: string[]; previousRoleKey: string | null }> {
    if (id === actorUserId) throw usersErrors.cannotModifySelf();

    const target = await this.getExistingOrThrow(id);
    const currentRoleKey = this.roleKeyOf(target);
    if (currentRoleKey === newRoleKey) {
      const { permissionKeys } = await this.rbacRepository.loadAuthorizationState(id);
      return { row: target, permissions: permissionKeys, previousRoleKey: currentRoleKey }; // idempotent no-op
    }

    if (currentRoleKey === "super_admin" && newRoleKey === "customer") {
      const canRemove = await this.rbacService.canRemoveSuperAdmin(id);
      if (!canRemove) throw usersErrors.lastSuperAdmin();
    }

    const role = await this.rbacRepository.findRoleByKey(newRoleKey);
    if (!role) throw usersErrors.notFound(); // unreachable: newRoleKey is zod-enum-validated against seeded roles

    await this.usersRepository.replaceRole(id, role.id);
    const updated = await this.getDetail(id);
    return { ...updated, previousRoleKey: currentRoleKey };
  }

  /// Reuses AuthService.forgotPassword verbatim — the same token/email
  /// mechanism a self-service "Forgot password?" click triggers. No password
  /// is ever generated, seen, or set by the admin; see docs/modules/USERS.md.
  async initiatePasswordReset(id: string): Promise<void> {
    const target = await this.getExistingOrThrow(id);
    await this.authService.forgotPassword(target.email);
  }

  // -- Customers module (Phase 6M) -------------------------------------
  // Same User table, a customer-only lens: roleKey is hardcoded here, never
  // client-suppliable, so this surface can never be used to browse or edit a
  // super_admin account. Order stats come from OrdersService (cross-domain
  // via its service, never OrdersRepository directly).

  async listCustomers(
    query: ListAdminCustomersQuery,
    skip: number,
    take: number,
  ): Promise<{ rows: AdminUserListRow[]; total: number; stats: Map<string, CustomerStats> }> {
    const { rows, total } = await this.usersRepository.listAdmin({
      search: query.search,
      status: query.status,
      roleKey: CUSTOMER_ROLE_KEY,
      skip,
      take,
    });
    const stats = await this.ordersService.getCustomerStatsByUserIds(rows.map((row) => row.id));
    return { rows, total, stats };
  }

  async getCustomerDetail(
    id: string,
  ): Promise<{ row: AdminUserDetailRow; permissions: string[]; stats: CustomerStats | undefined }> {
    const row = await this.getExistingCustomerOrThrow(id);
    const { permissionKeys } = await this.rbacRepository.loadAuthorizationState(id);
    const stats = await this.ordersService.getCustomerStatsByUserIds([id]);
    return { row, permissions: permissionKeys, stats: stats.get(id) };
  }

  async createCustomer(input: CreateCustomerInput): Promise<PublicUser> {
    return this.authService.adminCreateCustomer(input);
  }

  async updateCustomerStatus(
    id: string,
    actorUserId: string,
    newStatus: UserStatus,
  ): Promise<{ row: AdminUserDetailRow; permissions: string[]; stats: CustomerStats | undefined }> {
    // Confirms this id actually resolves to a customer before delegating to
    // the shared updateStatus logic (self-protection/last-admin guards live
    // there but are moot for a customer target; this call is what keeps a
    // super_admin account unreachable through the Customers surface).
    await this.getExistingCustomerOrThrow(id);
    const { row, permissions } = await this.updateStatus(id, actorUserId, newStatus);
    const stats = await this.ordersService.getCustomerStatsByUserIds([id]);
    return { row, permissions, stats: stats.get(id) };
  }

  /// Partial update of a customer's own identity/address fields — never
  /// status/role (those stay on their own dedicated endpoints with their
  /// own transition rules). Email uniqueness is re-checked the same way
  /// AuthService.adminCreateCustomer already does.
  async updateCustomer(
    id: string,
    input: UpdateCustomerInput,
  ): Promise<{ row: AdminUserDetailRow; permissions: string[]; stats: CustomerStats | undefined }> {
    await this.getExistingCustomerOrThrow(id);
    if (input.email) {
      const existing = await this.usersRepository.findByEmailIncludingDeleted(input.email);
      if (existing && existing.id !== id) throw usersErrors.emailAlreadyExists();
    }
    await this.usersRepository.updateFields(id, input);
    return this.getCustomerDetail(id);
  }

  /// Hard-deletes a customer with zero orders (nothing references them, so
  /// a real row delete is safe); soft-deletes (sets deletedAt) a customer
  /// who has order history, since Order.userId is onDelete: Restrict and
  /// deleting the row would destroy order-history attribution. Either way,
  /// a soft-deleted row is already excluded by every listAdmin/
  /// findAdminDetailById query's existing deletedAt: null filter, and
  /// sessions are revoked the same as a suspend. Returns which branch ran
  /// so the caller can record it on the audit entry.
  async deleteCustomer(id: string, actorUserId: string): Promise<{ hardDeleted: boolean }> {
    // Role-scope check first (same precedence as updateCustomerStatus) — a
    // super_admin id 404s through this customer-scoped surface even when it
    // happens to be the caller's own id; the self-protection check below is
    // for the (otherwise unreachable, since only staff call this) case of a
    // customer id matching the actor.
    await this.getExistingCustomerOrThrow(id);
    if (id === actorUserId) throw usersErrors.cannotModifySelf();

    const stats = await this.ordersService.getCustomerStatsByUserIds([id]);
    const orderCount = stats.get(id)?.orderCount ?? 0;

    if (orderCount === 0) {
      await this.usersRepository.hardDelete(id);
    } else {
      await this.usersRepository.softDelete(id);
    }
    await this.authRepository.revokeAllSessionsForUser(id, "admin_deleted");
    return { hardDeleted: orderCount === 0 };
  }

  private async getExistingCustomerOrThrow(id: string): Promise<AdminUserDetailRow> {
    const row = await this.getExistingOrThrow(id);
    if (this.roleKeyOf(row) !== CUSTOMER_ROLE_KEY) throw usersErrors.notFound();
    return row;
  }

  private roleKeyOf(user: AdminUserDetailRow): string | null {
    return user.roles[0]?.role.key ?? null;
  }

  private async getExistingOrThrow(id: string): Promise<AdminUserDetailRow> {
    const row = await this.usersRepository.findAdminDetailById(id);
    if (!row) throw usersErrors.notFound();
    return row;
  }
}
