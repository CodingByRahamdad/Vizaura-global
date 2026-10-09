import { describe, expect, it, vi } from "vitest";
import { RbacService } from "../../src/modules/rbac/rbac.service.js";
import type { AuthorizationState } from "../../src/modules/rbac/rbac.repository.js";

function fakeRepository(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    loadAuthorizationState: vi.fn(),
    findRoleByKey: vi.fn(),
    countSuperAdminAssignments: vi.fn().mockResolvedValue(0),
    ...overrides,
  } as never;
}

const state: AuthorizationState = {
  roleKeys: ["store_manager"],
  permissionKeys: ["products:read", "products:update", "orders:read"],
};

describe("RbacService permission checks (no role-name checks anywhere)", () => {
  it("hasPermission checks set membership, not role identity", () => {
    const service = new RbacService(fakeRepository());
    expect(service.hasPermission(state, "products:read")).toBe(true);
    expect(service.hasPermission(state, "products:delete")).toBe(false);
  });

  it("hasAllPermissions requires every key present", () => {
    const service = new RbacService(fakeRepository());
    expect(service.hasAllPermissions(state, ["products:read", "orders:read"])).toBe(true);
    expect(service.hasAllPermissions(state, ["products:read", "products:delete"])).toBe(false);
  });

  it("hasAnyPermission requires at least one key present", () => {
    const service = new RbacService(fakeRepository());
    expect(service.hasAnyPermission(state, ["products:delete", "orders:read"])).toBe(true);
    expect(service.hasAnyPermission(state, ["products:delete", "orders:delete"])).toBe(false);
  });

  it("an empty permission set grants nothing", () => {
    const service = new RbacService(fakeRepository());
    const empty: AuthorizationState = { roleKeys: [], permissionKeys: [] };
    expect(service.hasPermission(empty, "products:read")).toBe(false);
  });
});

describe("ownership-or-permission authorization", () => {
  it("allows the resource owner regardless of permissions", () => {
    const service = new RbacService(fakeRepository());
    const empty: AuthorizationState = { roleKeys: [], permissionKeys: [] };
    const allowed = service.authorizeOwnerOrPermission({
      resourceOwnerId: "user-1",
      requesterId: "user-1",
      state: empty,
      overridePermission: "orders:read",
    });
    expect(allowed).toBe(true);
  });

  it("allows a non-owner who holds the override permission", () => {
    const service = new RbacService(fakeRepository());
    const allowed = service.authorizeOwnerOrPermission({
      resourceOwnerId: "user-1",
      requesterId: "user-2",
      state,
      overridePermission: "orders:read",
    });
    expect(allowed).toBe(true);
  });

  it("denies a non-owner without the override permission", () => {
    const service = new RbacService(fakeRepository());
    const allowed = service.authorizeOwnerOrPermission({
      resourceOwnerId: "user-1",
      requesterId: "user-2",
      state,
      overridePermission: "orders:delete",
    });
    expect(allowed).toBe(false);
  });
});

describe("system-role protection", () => {
  it("refuses to remove the last super_admin assignment", async () => {
    const repository = fakeRepository({ countSuperAdminAssignments: vi.fn().mockResolvedValue(0) });
    const service = new RbacService(repository);
    await expect(service.canRemoveSuperAdmin("user-1")).resolves.toBe(false);
  });

  it("allows removal when another super_admin remains", async () => {
    const repository = fakeRepository({ countSuperAdminAssignments: vi.fn().mockResolvedValue(1) });
    const service = new RbacService(repository);
    await expect(service.canRemoveSuperAdmin("user-1")).resolves.toBe(true);
  });
});
