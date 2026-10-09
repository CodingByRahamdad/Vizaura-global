import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { signAccessToken, verifyAccessToken } from "../../src/security/jwt.js";
import { env } from "../../src/config/env.js";

const claims = { sub: "user-123", sid: "session-456" };

describe("access JWT", () => {
  it("round-trips sub/sid through sign and verify", () => {
    const token = signAccessToken(claims);
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(claims.sub);
    expect(decoded.sid).toBe(claims.sid);
  });

  it("sets the documented issuer and audience", () => {
    const token = signAccessToken(claims);
    const decoded = verifyAccessToken(token);
    expect(decoded.iss).toBe(env.jwt.issuer);
    expect(decoded.aud).toBe(env.jwt.audience);
  });

  it("carries no authorization data beyond sub/sid", () => {
    const token = signAccessToken(claims);
    const payload = jwt.decode(token) as Record<string, unknown>;
    const allowedKeys = new Set(["sub", "sid", "iat", "exp", "iss", "aud"]);
    for (const key of Object.keys(payload)) {
      expect(allowedKeys.has(key)).toBe(true);
    }
  });

  it("uses HS256", () => {
    const token = signAccessToken(claims);
    const decoded = jwt.decode(token, { complete: true });
    expect(decoded?.header.alg).toBe("HS256");
  });

  it("rejects a token signed with a different secret", () => {
    const foreignToken = jwt.sign(claims, "an-entirely-different-secret-value", {
      algorithm: "HS256",
      issuer: env.jwt.issuer,
      audience: env.jwt.audience,
      expiresIn: "15m",
    });
    expect(() => verifyAccessToken(foreignToken)).toThrow();
  });

  it("rejects a token with the wrong issuer", () => {
    const token = jwt.sign(claims, env.jwt.accessSecret, {
      algorithm: "HS256",
      issuer: "some-other-issuer",
      audience: env.jwt.audience,
      expiresIn: "15m",
    });
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it("rejects a token with the wrong audience", () => {
    const token = jwt.sign(claims, env.jwt.accessSecret, {
      algorithm: "HS256",
      issuer: env.jwt.issuer,
      audience: "some-other-audience",
      expiresIn: "15m",
    });
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it("rejects an expired token", () => {
    const token = jwt.sign(claims, env.jwt.accessSecret, {
      algorithm: "HS256",
      issuer: env.jwt.issuer,
      audience: env.jwt.audience,
      expiresIn: "-1s",
    });
    expect(() => verifyAccessToken(token)).toThrow(jwt.TokenExpiredError);
  });

  it("rejects a token signed with the 'none' algorithm", () => {
    const token = jwt.sign(claims, "", {
      algorithm: "none",
      issuer: env.jwt.issuer,
      audience: env.jwt.audience,
      expiresIn: "15m",
    });
    expect(() => verifyAccessToken(token)).toThrow();
  });
});
