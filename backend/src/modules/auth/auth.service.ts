import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { AuthRepository } from "./auth.repository.js";
import { UsersRepository } from "../users/users.repository.js";
import { RbacService } from "../rbac/rbac.service.js";
import { toPublicUser, type PublicUser } from "../users/users.mapper.js";
import {
  hashPassword,
  verifyPassword,
  verifyDummyPassword,
  validatePasswordPolicy,
} from "../../security/password.js";
import { generateOpaqueToken, hashToken, newSessionFamilyId } from "../../security/tokens.js";
import { signAccessToken } from "../../security/jwt.js";
import { setAccessCookie, setRefreshCookie, clearAuthCookies, readRefreshCookie } from "../../security/cookies.js";
import { getEmailProvider } from "../../integrations/email/index.js";
import { authErrors, usersErrors } from "../../errors/AppError.js";
import { recordLoginFailure, clearLoginFailures } from "../../security/loginAttemptTracker.js";
import { notifyAdmins } from "../notifications/notifications.helper.js";
import type {
  RegisterInput,
  LoginInput,
  ResetPasswordInput,
  ChangePasswordInput,
  ChangeEmailInput,
} from "./auth.validators.js";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes
const REFRESH_REUSE_GRACE_MS = 15 * 1000; // 15 seconds

export interface AuthResult {
  user: PublicUser;
  roleKeys: string[];
  permissionKeys: string[];
}

function requestMeta(req: Request): { ipAddress?: string; userAgent?: string } {
  return {
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"]?.slice(0, 512),
  };
}

function refreshExpiry(): Date {
  return new Date(Date.now() + env.refreshToken.expiresInDays * 24 * 60 * 60 * 1000);
}

export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository = new AuthRepository(),
    private readonly usersRepository: UsersRepository = new UsersRepository(),
    private readonly rbacService: RbacService = new RbacService(),
  ) {}

  // -- Registration -------------------------------------------------------

  async register(input: RegisterInput, req: Request, res: Response): Promise<AuthResult> {
    const policyViolation = validatePasswordPolicy(input.password);
    if (policyViolation) {
      throw authErrors.validation({ fields: [{ path: "password", message: policyViolation.message }] });
    }

    const existing = await this.usersRepository.findByEmailIncludingDeleted(input.email);

    if (existing) {
      // Anti-enumeration (approved Phase 4D-1 decision): registering an
      // address that already has an account looks identical to the caller.
      // The existing owner is notified instead of the caller being told.
      if (existing.deletedAt === null) {
        try {
          await getEmailProvider().sendExistingAccountNotice({
            to: existing.email,
            firstName: existing.firstName,
          });
        } catch (error) {
          console.error(`existing-account notice email failed for user ${existing.id}:`, error);
        }
      }
      // A soft-deleted account is treated the same way: re-registration is a
      // deliberate account-recreation decision left to a later phase, not an
      // implicit side effect of hitting this endpoint again.
      return this.buildGenericRegistrationResult(input);
    }

    const passwordHash = await hashPassword(input.password);
    const rawVerificationToken = generateOpaqueToken();
    const verificationTokenHash = hashToken(rawVerificationToken);

    const user = await this.authRepository.createUserWithCustomerRole({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      verificationTokenHash,
      verificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    });

    try {
      await getEmailProvider().sendEmailVerification({
        to: user.email,
        firstName: user.firstName,
        verifyUrl: `${env.appUrl}/verify-email?token=${rawVerificationToken}`,
      });
    } catch (error) {
      console.error(`verification email failed for user ${user.id}:`, error);
    }

    await notifyAdmins({
      type: "CUSTOMER_REGISTERED",
      title: "New customer registered",
      message: `${user.firstName} ${user.lastName} (${user.email}) created an account.`,
      entityType: "User",
      entityId: user.id,
      requiredPermission: "customers:read",
    });

    // Approved decision: auto-login on registration. The customer role
    // permits login while unverified (verification gates ordering/reviews,
    // not authentication) — see docs/AUTH_SECURITY.md.
    await this.issueSession(user.id, req, res);
    const { roleKeys, permissionKeys } = await this.rbacService.getAuthorizationState(user.id);

    return { user: toPublicUser(user), roleKeys, permissionKeys };
  }

  /// Builds a response indistinguishable from a real registration, for the
  /// existing-email branch. No session is created and no cookies are set —
  /// the caller does not control this account.
  private buildGenericRegistrationResult(input: RegisterInput): AuthResult {
    return {
      user: {
        id: "00000000-0000-0000-0000-000000000000",
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ?? null,
        status: "PENDING_VERIFICATION",
        emailVerified: false,
        createdAt: new Date().toISOString(),
      },
      roleKeys: ["customer"],
      permissionKeys: [],
    };
  }

  /// Admin-created-customer path (Phase 6M's Customers module) — deliberately
  /// separate from register(): no anti-enumeration masking (a staff-facing
  /// form is expected to say the email is taken), no auto-login (this isn't
  /// the caller's own account). Otherwise identical password policy/Argon2id
  /// hash/"customer role, unconditionally" posture as register() — but
  /// pre-verified immediately (ACTIVE, emailVerifiedAt set) and no
  /// verification email is sent, since a staff-created account doesn't need
  /// to prove the customer owns that inbox.
  async adminCreateCustomer(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    countryCode?: string;
  }): Promise<PublicUser> {
    const policyViolation = validatePasswordPolicy(input.password);
    if (policyViolation) {
      throw authErrors.validation({ fields: [{ path: "password", message: policyViolation.message }] });
    }

    const existing = await this.usersRepository.findByEmailIncludingDeleted(input.email);
    if (existing) throw usersErrors.emailAlreadyExists();

    const passwordHash = await hashPassword(input.password);
    const user = await this.authRepository.createPreVerifiedCustomer({ ...input, passwordHash });

    return toPublicUser(user);
  }

  // -- Login ----------------------------------------------------------------

  async login(input: LoginInput, req: Request, res: Response): Promise<AuthResult> {
    const ip = req.ip ?? "unknown";
    const user = await this.usersRepository.findActiveByEmail(input.email);

    if (!user) {
      // Real Argon2id verification against a fixed dummy hash so response
      // timing does not reveal whether the account exists.
      await verifyDummyPassword(input.password);
      recordLoginFailure(input.email, ip);
      throw authErrors.invalidCredentials();
    }

    const passwordValid = await verifyPassword(user.passwordHash, input.password);
    if (!passwordValid) {
      recordLoginFailure(input.email, ip);
      throw authErrors.invalidCredentials();
    }

    // Password was correct, so revealing account state here does not help an
    // attacker who doesn't already know the password.
    if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
      throw authErrors.accountSuspended();
    }

    const { roleKeys, permissionKeys } = await this.rbacService.getAuthorizationState(user.id);

    // Unverified customers may log in; unverified staff (any non-customer
    // role) may not, per the approved decision.
    const isCustomerOnly = roleKeys.length === 0 || roleKeys.every((key) => key === "customer");
    if (user.emailVerifiedAt === null && !isCustomerOnly) {
      throw authErrors.emailNotVerified();
    }

    clearLoginFailures(input.email, ip);
    await this.issueSession(user.id, req, res);
    await this.usersRepository.updateLastLogin(user.id);

    return { user: toPublicUser(user), roleKeys, permissionKeys };
  }

  // -- Logout ---------------------------------------------------------------

  async logout(req: Request, res: Response): Promise<void> {
    const rawToken = readRefreshCookie(req);
    if (rawToken) {
      const session = await this.authRepository.findSessionByRefreshHash(hashToken(rawToken));
      if (session) {
        await this.authRepository.revokeSessionIfActive(session.id, "logout");
      }
    }
    clearAuthCookies(res);
  }

  async logoutAll(userId: string, res: Response): Promise<void> {
    await this.authRepository.revokeAllSessionsForUser(userId, "logout_all");
    clearAuthCookies(res);
  }

  // -- Refresh ----------------------------------------------------------------

  async refresh(req: Request, res: Response): Promise<void> {
    const rawToken = readRefreshCookie(req);
    if (!rawToken) {
      throw authErrors.invalidRefreshToken();
    }

    const session = await this.authRepository.findSessionByRefreshHash(hashToken(rawToken));
    if (!session) {
      throw authErrors.invalidRefreshToken();
    }

    if (session.revokedAt !== null) {
      const withinGrace = Date.now() - session.revokedAt.getTime() <= REFRESH_REUSE_GRACE_MS;
      if (session.revokedReason === "rotated" && withinGrace) {
        // Benign race: a legitimate concurrent request already rotated this
        // token. The family stays intact; the client retries with its
        // already-issued replacement.
        throw authErrors.refreshRetry();
      }
      if (session.revokedReason !== "rotated") {
        // Expected revocation (logout, logout_all, password_change,
        // password_reset, expired, user_suspended) — not an attack signal.
        // The family was already fully revoked by whatever caused this, so
        // there is nothing further to revoke here.
        clearAuthCookies(res);
        throw authErrors.sessionExpired();
      }
      // A "rotated" revocation outside the grace window: the token has
      // leaked, because the legitimate client would be holding the newest
      // one in the family.
      clearAuthCookies(res);
      await this.authRepository.revokeSessionFamily(session.familyId, "reuse_detected");
      throw authErrors.refreshReuseDetected();
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.authRepository.revokeSessionIfActive(session.id, "expired");
      clearAuthCookies(res);
      throw authErrors.sessionExpired();
    }

    const user = await this.usersRepository.findActiveById(session.userId);
    if (!user || user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
      await this.authRepository.revokeSessionFamily(session.familyId, "user_suspended");
      clearAuthCookies(res);
      throw authErrors.sessionExpired();
    }
    if (user.passwordChangedAt && session.createdAt.getTime() < user.passwordChangedAt.getTime()) {
      await this.authRepository.revokeSessionFamily(session.familyId, "password_change");
      clearAuthCookies(res);
      throw authErrors.sessionExpired();
    }

    // Race-safe rotation: this UPDATE only succeeds if the session was still
    // active at the moment it ran. If a concurrent request already won the
    // race, `rotated` is 0 and this request must NOT also mint a session —
    // it falls back to the reuse/grace path on the caller's next attempt.
    const rotated = await this.authRepository.revokeSessionIfActive(session.id, "rotated");
    if (rotated === 0) {
      throw authErrors.refreshRetry();
    }

    const newRawToken = generateOpaqueToken();
    const newSession = await this.authRepository.createSession({
      userId: user.id,
      refreshTokenHash: hashToken(newRawToken),
      familyId: session.familyId,
      expiresAt: refreshExpiry(),
      ...requestMeta(req),
    });

    const accessToken = signAccessToken({ sub: user.id, sid: newSession.id });
    setAccessCookie(res, accessToken);
    setRefreshCookie(res, newRawToken);
  }

  // -- Change password --------------------------------------------------

  async changePassword(userId: string, input: ChangePasswordInput, req: Request, res: Response): Promise<void> {
    const user = await this.usersRepository.findActiveById(userId);
    if (!user) {
      throw authErrors.unauthorized();
    }

    const currentValid = await verifyPassword(user.passwordHash, input.currentPassword);
    if (!currentValid) {
      throw authErrors.invalidCredentials();
    }

    const sameAsOld = await verifyPassword(user.passwordHash, input.newPassword);
    if (sameAsOld) {
      throw authErrors.passwordReused();
    }

    const policyViolation = validatePasswordPolicy(input.newPassword);
    if (policyViolation) {
      throw authErrors.validation({ fields: [{ path: "newPassword", message: policyViolation.message }] });
    }

    const newPasswordHash = await hashPassword(input.newPassword);
    const rawRefreshToken = generateOpaqueToken();
    const familyId = newSessionFamilyId();

    const session = await this.authRepository.changePasswordTransaction({
      userId: user.id,
      newPasswordHash,
      newSession: {
        userId: user.id,
        refreshTokenHash: hashToken(rawRefreshToken),
        familyId,
        expiresAt: refreshExpiry(),
        ...requestMeta(req),
      },
    });

    const accessToken = signAccessToken({ sub: user.id, sid: session.id });
    setAccessCookie(res, accessToken);
    setRefreshCookie(res, rawRefreshToken);
  }

  // -- Change email -------------------------------------------------------

  async changeEmail(userId: string, input: ChangeEmailInput, req: Request, res: Response): Promise<void> {
    const user = await this.usersRepository.findActiveById(userId);
    if (!user) {
      throw authErrors.unauthorized();
    }

    const currentValid = await verifyPassword(user.passwordHash, input.currentPassword);
    if (!currentValid) {
      throw authErrors.invalidCredentials();
    }

    if (input.newEmail === user.email) {
      throw authErrors.emailUnchanged();
    }

    const existing = await this.usersRepository.findByEmailIncludingDeleted(input.newEmail);
    if (existing) {
      throw authErrors.emailAlreadyInUse();
    }

    const rawRefreshToken = generateOpaqueToken();
    const familyId = newSessionFamilyId();

    const session = await this.authRepository.changeEmailTransaction({
      userId: user.id,
      newEmail: input.newEmail,
      newSession: {
        userId: user.id,
        refreshTokenHash: hashToken(rawRefreshToken),
        familyId,
        expiresAt: refreshExpiry(),
        ...requestMeta(req),
      },
    });

    const accessToken = signAccessToken({ sub: user.id, sid: session.id });
    setAccessCookie(res, accessToken);
    setRefreshCookie(res, rawRefreshToken);
  }

  // -- Forgot / reset password --------------------------------------------

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersRepository.findActiveByEmail(email);
    // Always the same generic outcome to the caller regardless of whether the
    // account exists (handled by the controller returning a fixed response).
    if (!user) return;

    await this.authRepository.invalidateOutstandingResetTokens(user.id);

    const rawToken = generateOpaqueToken();
    await this.authRepository.createPasswordResetToken({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    });

    try {
      await getEmailProvider().sendPasswordReset({
        to: user.email,
        firstName: user.firstName,
        resetUrl: `${env.appUrl}/reset-password?token=${rawToken}`,
      });
    } catch (error) {
      console.error(`password reset email failed for user ${user.id}:`, error);
    }
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const tokenHash = hashToken(input.token);
    const record = await this.authRepository.findPasswordResetTokenByHash(tokenHash);

    if (!record || record.consumedAt !== null || record.expiresAt.getTime() <= Date.now()) {
      throw authErrors.invalidResetToken();
    }

    const policyViolation = validatePasswordPolicy(input.newPassword);
    if (policyViolation) {
      throw authErrors.validation({ fields: [{ path: "newPassword", message: policyViolation.message }] });
    }

    const newPasswordHash = await hashPassword(input.newPassword);
    await this.authRepository.resetPasswordTransaction({
      tokenId: record.id,
      userId: record.userId,
      newPasswordHash,
    });
    // No auto-login: the caller must sign in again with the new password.
  }

  // -- Email verification --------------------------------------------------

  async verifyEmail(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const record = await this.authRepository.findEmailVerificationTokenByHash(tokenHash);

    if (!record) {
      throw authErrors.invalidVerificationToken();
    }

    const user = await this.usersRepository.findActiveById(record.userId);
    if (user?.emailVerifiedAt) {
      // Idempotent: an already-verified account treats a re-click as success.
      return;
    }

    if (record.consumedAt !== null || record.expiresAt.getTime() <= Date.now()) {
      throw authErrors.invalidVerificationToken();
    }

    await this.authRepository.consumeEmailVerificationToken(record.id);
    await this.authRepository.markEmailVerified(record.userId);
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.usersRepository.findActiveById(userId);
    if (!user) {
      throw authErrors.unauthorized();
    }
    if (user.emailVerifiedAt !== null) {
      return;
    }

    await this.authRepository.invalidateOutstandingVerificationTokens(user.id);

    const rawToken = generateOpaqueToken();
    await this.authRepository.createEmailVerificationToken({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    });

    try {
      await getEmailProvider().sendEmailVerification({
        to: user.email,
        firstName: user.firstName,
        verifyUrl: `${env.appUrl}/verify-email?token=${rawToken}`,
      });
    } catch (error) {
      console.error(`verification email failed for user ${user.id}:`, error);
    }
  }

  // -- Shared helpers ---------------------------------------------------

  private async issueSession(userId: string, req: Request, res: Response) {
    const rawRefreshToken = generateOpaqueToken();
    const familyId = newSessionFamilyId();

    const session = await this.authRepository.createSession({
      userId,
      refreshTokenHash: hashToken(rawRefreshToken),
      familyId,
      expiresAt: refreshExpiry(),
      ...requestMeta(req),
    });

    const accessToken = signAccessToken({ sub: userId, sid: session.id });
    setAccessCookie(res, accessToken);
    setRefreshCookie(res, rawRefreshToken);
    return session;
  }
}
