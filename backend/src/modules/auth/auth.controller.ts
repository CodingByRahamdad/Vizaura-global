import type { NextFunction, Request, Response } from "express";
import { AuthService } from "./auth.service.js";
import { RbacService } from "../rbac/rbac.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { toPublicUser } from "../users/users.mapper.js";
import { toAuthResponse } from "./auth.mapper.js";
import { successResponse } from "../../utils/apiResponse.js";
import { authErrors } from "../../errors/AppError.js";
import type {
  ChangeEmailInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
  VerifyEmailInput,
} from "./auth.validators.js";

const authService = new AuthService();
const rbacService = new RbacService();
const usersRepository = new UsersRepository();

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.register(req.body as RegisterInput, req, res);
    res.status(201).json(successResponse(toAuthResponse(result)));
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(req.body as LoginInput, req, res);
    res.status(200).json(successResponse(toAuthResponse(result)));
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.logout(req, res);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function logoutAll(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw authErrors.unauthorized();
    await authService.logoutAll(req.auth.userId, res);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.refresh(req, res);
    res.status(200).json(successResponse({}));
  } catch (error) {
    next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw authErrors.unauthorized();
    const user = await usersRepository.findActiveById(req.auth.userId);
    if (!user) throw authErrors.unauthorized();

    // Database-backed current authorization state — /me is specifically the
    // endpoint permitted to return roles/permissions.
    const { roleKeys, permissionKeys } = await rbacService.getAuthorizationState(user.id);
    res.status(200).json(
      successResponse({ user: toPublicUser(user), roles: roleKeys, permissions: permissionKeys }),
    );
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw authErrors.unauthorized();
    const input = req.body as UpdateProfileInput;
    const user = await usersRepository.updateFields(req.auth.userId, input);
    res.status(200).json(successResponse({ user: toPublicUser(user) }));
  } catch (error) {
    next(error);
  }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.body as VerifyEmailInput;
    await authService.verifyEmail(token);
    res.status(200).json(successResponse({ verified: true }));
  } catch (error) {
    next(error);
  }
}

export async function resendVerification(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw authErrors.unauthorized();
    await authService.resendVerification(req.auth.userId);
    res.status(202).json(successResponse({ sent: true }));
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body as ForgotPasswordInput;
    await authService.forgotPassword(email);
    // Identical response whether or not the account exists.
    res
      .status(200)
      .json(successResponse({ message: "If an account exists for this email, a reset link has been sent." }));
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.resetPassword(req.body as ResetPasswordInput);
    res.status(200).json(successResponse({ reset: true }));
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw authErrors.unauthorized();
    await authService.changePassword(req.auth.userId, req.body as ChangePasswordInput, req, res);
    res.status(200).json(successResponse({ changed: true }));
  } catch (error) {
    next(error);
  }
}

export async function changeEmail(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw authErrors.unauthorized();
    await authService.changeEmail(req.auth.userId, req.body as ChangeEmailInput, req, res);
    res.status(200).json(successResponse({ changed: true }));
  } catch (error) {
    next(error);
  }
}
