import { apiFetch, ApiError } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import type {
  AuthSession,
  ChangeEmailPayload,
  ChangePasswordPayload,
  ForgotPasswordPayload,
  LoginPayload,
  PublicUser,
  RegisterPayload,
  ResetPasswordPayload,
  UpdateProfilePayload,
} from "@/lib/types/auth";

/** Session/identity data must never be cached — always hits the backend fresh. */
const NO_STORE = { cache: "no-store" as const };

export async function login(payload: LoginPayload): Promise<AuthSession> {
  return apiFetch<AuthSession>(ENDPOINTS.auth.login, {
    method: "POST",
    body: JSON.stringify(payload),
    ...NO_STORE,
  });
}

export async function register(payload: RegisterPayload): Promise<AuthSession> {
  return apiFetch<AuthSession>(ENDPOINTS.auth.register, {
    method: "POST",
    body: JSON.stringify(payload),
    ...NO_STORE,
  });
}

export async function logout(): Promise<void> {
  await apiFetch<Record<string, never>>(ENDPOINTS.auth.logout, {
    method: "POST",
    ...NO_STORE,
  });
}

export async function logoutAll(): Promise<void> {
  await apiFetch<Record<string, never>>(ENDPOINTS.auth.logoutAll, {
    method: "POST",
    ...NO_STORE,
  });
}

export async function forgotPassword(payload: ForgotPasswordPayload): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(ENDPOINTS.auth.forgotPassword, {
    method: "POST",
    body: JSON.stringify(payload),
    ...NO_STORE,
  });
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<{ reset: boolean }> {
  return apiFetch<{ reset: boolean }>(ENDPOINTS.auth.resetPassword, {
    method: "POST",
    body: JSON.stringify(payload),
    ...NO_STORE,
  });
}

export async function getMe(): Promise<AuthSession> {
  return apiFetch<AuthSession>(ENDPOINTS.auth.me, NO_STORE);
}

async function updateProfileRequest(payload: UpdateProfilePayload): Promise<{ user: PublicUser }> {
  return apiFetch<{ user: PublicUser }>(ENDPOINTS.auth.me, {
    method: "PATCH",
    body: JSON.stringify(payload),
    ...NO_STORE,
  });
}

/** PATCH /auth/me (authenticate only) — self-service profile edit, never email/password/status/role.
 * Same inline refreshOnce() retry as resendVerification/changePassword above (avoids a circular
 * import with withAuthRetry.ts, which itself imports refreshOnce from this file). */
export async function updateProfile(payload: UpdateProfilePayload): Promise<{ user: PublicUser }> {
  try {
    return await updateProfileRequest(payload);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await refreshOnce();
      return await updateProfileRequest(payload);
    }
    throw error;
  }
}

/** No auth required — the token itself is the credential (see auth.routes.ts). */
export async function verifyEmail(token: string): Promise<{ verified: boolean }> {
  return apiFetch<{ verified: boolean }>(ENDPOINTS.auth.verifyEmail, {
    method: "POST",
    body: JSON.stringify({ token }),
    ...NO_STORE,
  });
}

async function refresh(): Promise<void> {
  await apiFetch<Record<string, never>>(ENDPOINTS.auth.refresh, {
    method: "POST",
    ...NO_STORE,
  });
}

let inFlightRefresh: Promise<void> | null = null;

/**
 * Concurrency-safe: concurrent callers share one in-flight refresh call.
 * Exported so other authenticated-endpoint service layers (e.g. lib/api/cart.ts)
 * can reuse this exact mechanism instead of inventing a second one.
 */
export function refreshOnce(): Promise<void> {
  if (!inFlightRefresh) {
    inFlightRefresh = refresh().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

async function resendVerificationRequest(): Promise<{ sent: boolean }> {
  return apiFetch<{ sent: boolean }>(ENDPOINTS.auth.resendVerification, {
    method: "POST",
    ...NO_STORE,
  });
}

/**
 * `authenticate`-gated — reuses this file's own refreshOnce() for the
 * 401-retry-once pattern directly (rather than importing the extracted
 * withAuthRetry() wrapper, which itself imports refreshOnce from this same
 * file and would create a circular import). Same single retry mechanism,
 * no second implementation.
 */
export async function resendVerification(): Promise<{ sent: boolean }> {
  try {
    return await resendVerificationRequest();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await refreshOnce();
      return await resendVerificationRequest();
    }
    throw error;
  }
}

async function changePasswordRequest(payload: ChangePasswordPayload): Promise<{ changed: boolean }> {
  return apiFetch<{ changed: boolean }>(ENDPOINTS.auth.changePassword, {
    method: "POST",
    body: JSON.stringify(payload),
    ...NO_STORE,
  });
}

/** `authenticate`-gated — same inline refreshOnce() retry as resendVerification() above. */
export async function changePassword(payload: ChangePasswordPayload): Promise<{ changed: boolean }> {
  try {
    return await changePasswordRequest(payload);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await refreshOnce();
      return await changePasswordRequest(payload);
    }
    throw error;
  }
}

async function changeEmailRequest(payload: ChangeEmailPayload): Promise<{ changed: boolean }> {
  return apiFetch<{ changed: boolean }>(ENDPOINTS.auth.changeEmail, {
    method: "POST",
    body: JSON.stringify(payload),
    ...NO_STORE,
  });
}

/** `authenticate`-gated — same inline refreshOnce() retry as changePassword() above. */
export async function changeEmail(payload: ChangeEmailPayload): Promise<{ changed: boolean }> {
  try {
    return await changeEmailRequest(payload);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await refreshOnce();
      return await changeEmailRequest(payload);
    }
    throw error;
  }
}

/**
 * Session bootstrap: GET /auth/me, and if the access-token cookie is missing
 * or expired (401), attempt exactly one refresh and retry exactly once. Not
 * a generic app-wide 401 interceptor — scoped to this one call, since no
 * other protected endpoint is consumed by the frontend yet (see
 * docs/CURRENT_TASK.md for the scoping rationale).
 */
export async function getMeWithRefresh(): Promise<AuthSession | null> {
  try {
    return await getMe();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      try {
        await refreshOnce();
        return await getMe();
      } catch {
        return null;
      }
    }
    return null;
  }
}
