import type { ApiEnvelope } from "@/lib/types/api";

// Falls back to the production backend so a missing/misnamed
// NEXT_PUBLIC_API_BASE_URL on Vercel can never silently turn every request
// into a relative-path fetch against the frontend's own origin.
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://vizaura-backend.onrender.com/api/v1";

const REQUEST_TIMEOUT_MS = 8000;

/**
 * The backend's CSRF middleware (backend/src/middleware/csrf.ts) requires
 * this header to simply be present (any value) on every non-GET request, in
 * addition to matching Origin — it never checks the header's value. Centralized
 * here so no caller has to remember it. Must match the backend's
 * CSRF_HEADER_NAME env var (default "x-requested-with").
 */
const CSRF_HEADER_NAME = "x-requested-with";
const CSRF_HEADER_VALUE = "XMLHttpRequest";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (method !== "GET" && method !== "HEAD") {
    headers.set(CSRF_HEADER_NAME, CSRF_HEADER_VALUE);
  }

  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      ...init,
      headers,
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ApiError("Request timed out", 0, "TIMEOUT");
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Request aborted", 0, "ABORTED");
    }
    throw new ApiError("Network error", 0, "NETWORK_ERROR");
  }

  // 204 No Content (e.g. POST /auth/logout) has no body to parse; a bare
  // ok+empty response is treated as a bodyless success.
  const raw = res.status === 204 ? "" : await res.text();
  const body: ApiEnvelope<T> = raw ? JSON.parse(raw) : { success: res.ok };

  if (!res.ok || body.success === false) {
    throw new ApiError(
      body?.error?.message ?? "Request failed",
      res.status,
      body?.error?.code,
      body?.error?.details
    );
  }

  return body;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const body = await request<T>(path, init);
  return body.data as T;
}

/** Like apiFetch, but also returns the envelope's `meta` (e.g. pagination). */
export async function apiFetchWithMeta<T>(
  path: string,
  init?: RequestInit
): Promise<{ data: T; meta: Record<string, unknown> }> {
  const body = await request<T>(path, init);
  return { data: body.data as T, meta: body.meta ?? {} };
}
