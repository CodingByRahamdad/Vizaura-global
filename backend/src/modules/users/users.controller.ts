import type { NextFunction, Request, Response } from "express";
import { UsersService } from "./users.service.js";
import { toAdminUserDetail, toAdminUserSummary, toAdminCustomerSummary, toAdminCustomerDetail } from "./users.mapper.js";
import { successResponse } from "../../utils/apiResponse.js";
import { authErrors } from "../../errors/AppError.js";
import { recordAudit } from "../audit/auditLog.helper.js";
import { notifyAdmins } from "../notifications/notifications.helper.js";
import { toSkipTake, toPaginationMeta } from "../catalog/pagination.js";
import type {
  ListAdminUsersQuery,
  UpdateUserRoleInput,
  UpdateUserStatusInput,
  UserIdParams,
  ListAdminCustomersQuery,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "./users.validators.js";

const usersService = new UsersService();

function requireUserId(req: Request): string {
  if (!req.auth) throw authErrors.unauthorized();
  return req.auth.userId;
}

export async function listAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as ListAdminUsersQuery;
    const { skip, take } = toSkipTake(query);
    const { rows, total } = await usersService.listAdmin(query, skip, take);
    res.status(200).json(successResponse(rows.map(toAdminUserSummary), toPaginationMeta(query, total)));
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as UserIdParams;
    const { row, permissions } = await usersService.getDetail(id);
    res.status(200).json(successResponse(toAdminUserDetail(row, permissions)));
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const actorUserId = requireUserId(req);
    const { id } = req.params as unknown as UserIdParams;
    const { status } = req.body as UpdateUserStatusInput;
    const { row, permissions } = await usersService.updateStatus(id, actorUserId, status);
    await recordAudit(req, {
      action: status === "SUSPENDED" ? "SUSPEND_USER" : "REACTIVATE_USER",
      entityType: "User",
      entityId: id,
      after: { status: row.status },
    });
    res.status(200).json(successResponse(toAdminUserDetail(row, permissions)));
  } catch (error) {
    next(error);
  }
}

export async function updateRole(req: Request, res: Response, next: NextFunction) {
  try {
    const actorUserId = requireUserId(req);
    const { id } = req.params as unknown as UserIdParams;
    const { role } = req.body as UpdateUserRoleInput;
    const { row, permissions, previousRoleKey } = await usersService.updateRole(id, actorUserId, role);
    await recordAudit(req, {
      action: "CHANGE_USER_ROLE",
      entityType: "User",
      entityId: id,
      before: { role: previousRoleKey },
      after: { role },
    });
    res.status(200).json(successResponse(toAdminUserDetail(row, permissions)));
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as UserIdParams;
    await usersService.initiatePasswordReset(id);
    await recordAudit(req, { action: "ADMIN_INITIATE_PASSWORD_RESET", entityType: "User", entityId: id });
    res.status(200).json(successResponse({ initiated: true }));
  } catch (error) {
    next(error);
  }
}

// -- Customers module (Phase 6M) -----------------------------------------

export async function listCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as ListAdminCustomersQuery;
    const { skip, take } = toSkipTake(query);
    const { rows, total, stats } = await usersService.listCustomers(query, skip, take);
    res.status(200).json(
      successResponse(
        rows.map((row) => toAdminCustomerSummary(row, stats.get(row.id))),
        toPaginationMeta(query, total),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function getCustomerById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as UserIdParams;
    const { row, permissions, stats } = await usersService.getCustomerDetail(id);
    res.status(200).json(successResponse(toAdminCustomerDetail(row, permissions, stats)));
  } catch (error) {
    next(error);
  }
}

export async function createCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as CreateCustomerInput;
    const user = await usersService.createCustomer(input);
    await recordAudit(req, { action: "CREATE_CUSTOMER", entityType: "User", entityId: user.id, after: user });
    await notifyAdmins({
      type: "CUSTOMER_REGISTERED",
      title: "New customer added",
      message: `${user.firstName} ${user.lastName} (${user.email}) was added as a customer.`,
      entityType: "User",
      entityId: user.id,
      requiredPermission: "customers:read",
    });
    res.status(201).json(successResponse(user));
  } catch (error) {
    next(error);
  }
}

export async function updateCustomerStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const actorUserId = requireUserId(req);
    const { id } = req.params as unknown as UserIdParams;
    const { status } = req.body as UpdateUserStatusInput;
    const { row, permissions, stats } = await usersService.updateCustomerStatus(id, actorUserId, status);
    await recordAudit(req, {
      action: status === "SUSPENDED" ? "SUSPEND_USER" : "REACTIVATE_USER",
      entityType: "User",
      entityId: id,
      after: { status: row.status },
    });
    res.status(200).json(successResponse(toAdminCustomerDetail(row, permissions, stats)));
  } catch (error) {
    next(error);
  }
}

export async function updateCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as unknown as UserIdParams;
    const input = req.body as UpdateCustomerInput;
    const { row, permissions, stats } = await usersService.updateCustomer(id, input);
    await recordAudit(req, { action: "UPDATE_CUSTOMER", entityType: "User", entityId: id, after: input });
    res.status(200).json(successResponse(toAdminCustomerDetail(row, permissions, stats)));
  } catch (error) {
    next(error);
  }
}

export async function deleteCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const actorUserId = requireUserId(req);
    const { id } = req.params as unknown as UserIdParams;
    const { hardDeleted } = await usersService.deleteCustomer(id, actorUserId);
    await recordAudit(req, {
      action: "DELETE_CUSTOMER",
      entityType: "User",
      entityId: id,
      after: { deletionMode: hardDeleted ? "hard" : "soft" },
    });
    res.status(200).json(successResponse({ deleted: true, hardDeleted }));
  } catch (error) {
    next(error);
  }
}
