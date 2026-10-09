import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import { authErrors } from "../../src/errors/AppError.js";
import { Prisma } from "../../src/generated/prisma/client.js";

function mockRes() {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as Response;
}

function mockReq(): Request {
  return { requestId: "test-request-id" } as unknown as Request;
}

describe("errorHandler", () => {
  it("maps an AppError to its status, code and message", () => {
    const res = mockRes();
    errorHandler(authErrors.invalidCredentials(), mockReq(), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "AUTH_INVALID_CREDENTIALS" }),
      }),
    );
  });

  it("includes details on validation errors without leaking raw values", () => {
    const res = mockRes();
    errorHandler(
      authErrors.validation({ fields: [{ path: "password", message: "too short" }] }),
      mockReq(),
      res,
      vi.fn(),
    );

    const [payload] = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(payload.error.details.fields[0].path).toBe("password");
  });

  it("maps a Prisma unique-constraint violation (P2002) to a clean 409", () => {
    const res = mockRes();
    const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
    });

    errorHandler(prismaError, mockReq(), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    const [payload] = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(payload.error.code).toBe("CONFLICT");
    expect(JSON.stringify(payload)).not.toMatch(/prisma/i);
  });

  it("maps an unrecognized error to a generic 500 with no internal detail", () => {
    const res = mockRes();
    errorHandler(new Error("some internal stack detail, DB connection string, etc"), mockReq(), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    const [payload] = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(payload.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(payload)).not.toContain("DB connection string");
  });

  it("never leaks a stack trace to the response body", () => {
    const res = mockRes();
    errorHandler(new Error("boom"), mockReq(), res, vi.fn());
    const [payload] = (res.json as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.stringify(payload)).not.toContain("at ");
  });
});
