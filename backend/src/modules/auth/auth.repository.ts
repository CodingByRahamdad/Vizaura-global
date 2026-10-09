import type { PrismaClient, Session, User } from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";

export interface CreateSessionInput {
  userId: string;
  refreshTokenHash: string;
  familyId: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

const CUSTOMER_ROLE_KEY = "customer";

export class AuthRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  // -- Registration -----------------------------------------------------

  /// Creates the user, attaches the customer role, and issues an email
  /// verification token in one transaction. Throws if the seeded "customer"
  /// role is missing (a deployment/seed error, not a user-facing one).
  async createUserWithCustomerRole(params: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phone?: string;
    verificationTokenHash: string;
    verificationExpiresAt: Date;
  }): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const customerRole = await tx.role.findUnique({ where: { key: CUSTOMER_ROLE_KEY } });
      if (!customerRole) {
        throw new Error(`Seeded role "${CUSTOMER_ROLE_KEY}" not found — run the database seed.`);
      }

      const user = await tx.user.create({
        data: {
          email: params.email,
          passwordHash: params.passwordHash,
          firstName: params.firstName,
          lastName: params.lastName,
          phone: params.phone,
          passwordChangedAt: new Date(),
        },
      });

      await tx.userRole.create({ data: { userId: user.id, roleId: customerRole.id } });

      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: params.verificationTokenHash,
          expiresAt: params.verificationExpiresAt,
        },
      });

      return user;
    });
  }

  /// Admin-created-customer path (Customers module) — pre-verified
  /// immediately (ACTIVE + emailVerifiedAt set), no EmailVerificationToken
  /// row, no verification email. Kept as its own method rather than
  /// branching createUserWithCustomerRole: that method's whole job is
  /// "create + issue a verification token", and threading an optional
  /// skip-the-token flag through it would make its one responsibility
  /// ambiguous.
  async createPreVerifiedCustomer(params: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    countryCode?: string;
  }): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const customerRole = await tx.role.findUnique({ where: { key: CUSTOMER_ROLE_KEY } });
      if (!customerRole) {
        throw new Error(`Seeded role "${CUSTOMER_ROLE_KEY}" not found — run the database seed.`);
      }

      const user = await tx.user.create({
        data: {
          email: params.email,
          passwordHash: params.passwordHash,
          firstName: params.firstName,
          lastName: params.lastName,
          phone: params.phone,
          addressLine1: params.addressLine1,
          addressLine2: params.addressLine2,
          city: params.city,
          region: params.region,
          postalCode: params.postalCode,
          countryCode: params.countryCode,
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          passwordChangedAt: new Date(),
        },
      });

      await tx.userRole.create({ data: { userId: user.id, roleId: customerRole.id } });

      return user;
    });
  }

  // -- Sessions -----------------------------------------------------------

  async createSession(input: CreateSessionInput): Promise<Session> {
    return this.prisma.session.create({
      data: {
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        familyId: input.familyId,
        expiresAt: input.expiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  async findSessionByRefreshHash(refreshTokenHash: string): Promise<Session | null> {
    return this.prisma.session.findUnique({ where: { refreshTokenHash } });
  }

  /// Conditional revoke: succeeds only if the session was not already
  /// revoked. This is the race-safety mechanism for rotation — see
  /// auth.service.ts refresh(). Returns the number of rows affected (0 or 1).
  async revokeSessionIfActive(sessionId: string, reason: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.count;
  }

  async revokeSessionFamily(familyId: string, reason: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async revokeAllSessionsForUser(userId: string, reason: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  // -- Email verification ---------------------------------------------------

  async createEmailVerificationToken(params: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.emailVerificationToken.create({ data: params });
  }

  async findEmailVerificationTokenByHash(tokenHash: string) {
    return this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
  }

  async consumeEmailVerificationToken(tokenId: string): Promise<void> {
    await this.prisma.emailVerificationToken.update({
      where: { id: tokenId },
      data: { consumedAt: new Date() },
    });
  }

  async invalidateOutstandingVerificationTokens(userId: string): Promise<void> {
    await this.prisma.emailVerificationToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date(), status: "ACTIVE" },
    });
  }

  // -- Password reset ---------------------------------------------------

  async createPasswordResetToken(params: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.prisma.passwordResetToken.create({ data: params });
  }

  async findPasswordResetTokenByHash(tokenHash: string) {
    return this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  async invalidateOutstandingResetTokens(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }

  /// Consumes the reset token, updates the password, revokes every session,
  /// and marks the email verified (completing a reset proves mailbox
  /// ownership) — all atomically.
  async resetPasswordTransaction(params: {
    tokenId: string;
    userId: string;
    newPasswordHash: string;
  }): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: params.tokenId },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: params.userId },
        data: {
          passwordHash: params.newPasswordHash,
          passwordChangedAt: new Date(),
          emailVerifiedAt: new Date(),
          status: "ACTIVE",
        },
      }),
      this.prisma.session.updateMany({
        where: { userId: params.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "password_reset" },
      }),
    ]);
  }

  /// Updates the password, revokes every existing session, and creates a
  /// fresh one for the current device — all atomically, so there is no
  /// window where the account has no valid session or has two conflicting
  /// password states.
  async changePasswordTransaction(params: {
    userId: string;
    newPasswordHash: string;
    newSession: CreateSessionInput;
  }): Promise<Session> {
    const [, , session] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: params.userId },
        data: { passwordHash: params.newPasswordHash, passwordChangedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { userId: params.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "password_change" },
      }),
      this.prisma.session.create({
        data: {
          userId: params.newSession.userId,
          refreshTokenHash: params.newSession.refreshTokenHash,
          familyId: params.newSession.familyId,
          expiresAt: params.newSession.expiresAt,
          ipAddress: params.newSession.ipAddress,
          userAgent: params.newSession.userAgent,
        },
      }),
    ]);
    return session;
  }

  /// Updates the email, revokes every existing session, and creates a fresh
  /// one for the current device — same atomicity rationale as
  /// changePasswordTransaction. Deliberately leaves emailVerifiedAt
  /// untouched so login with the new email works immediately.
  async changeEmailTransaction(params: {
    userId: string;
    newEmail: string;
    newSession: CreateSessionInput;
  }): Promise<Session> {
    const [, , session] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: params.userId },
        data: { email: params.newEmail },
      }),
      this.prisma.session.updateMany({
        where: { userId: params.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "email_change" },
      }),
      this.prisma.session.create({
        data: {
          userId: params.newSession.userId,
          refreshTokenHash: params.newSession.refreshTokenHash,
          familyId: params.newSession.familyId,
          expiresAt: params.newSession.expiresAt,
          ipAddress: params.newSession.ipAddress,
          userAgent: params.newSession.userAgent,
        },
      }),
    ]);
    return session;
  }
}
