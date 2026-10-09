/**
 * Types mirror the backend's actual auth response shapes verbatim
 * (backend/src/modules/auth/auth.mapper.ts, auth.controller.ts).
 */

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthSession {
  user: PublicUser;
  roles: string[];
  permissions: string[];
}

export interface LoginPayload {
  email: string;
  password: string;
  captchaToken: string;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  captchaToken: string;
}

export interface ForgotPasswordPayload {
  email: string;
  captchaToken: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
  captchaToken: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  captchaToken: string;
}

export interface ChangeEmailPayload {
  currentPassword: string;
  newEmail: string;
  captchaToken: string;
}

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
}
