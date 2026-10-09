import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

/// Access-token claims. Deliberately minimal: no email, name, phone, roles,
/// permissions or account status. Authorization state is always re-read from
/// the database on every request (see middleware/authenticate.ts), so a
/// permission/role/suspension change takes effect immediately rather than
/// waiting for a token to expire.
export interface AccessTokenClaims {
  sub: string; // userId
  sid: string; // sessionId
}

export interface DecodedAccessToken extends AccessTokenClaims {
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, env.jwt.accessSecret, {
    algorithm: "HS256",
    expiresIn: env.jwt.accessExpiresIn as jwt.SignOptions["expiresIn"],
    issuer: env.jwt.issuer,
    audience: env.jwt.audience,
  });
}

/// Verifies against the current signing secret, then — if that fails — the
/// previous one, so JWT_ACCESS_SECRET can be rotated without invalidating
/// every outstanding access token immediately.
export function verifyAccessToken(token: string): DecodedAccessToken {
  const options: jwt.VerifyOptions = {
    algorithms: ["HS256"],
    issuer: env.jwt.issuer,
    audience: env.jwt.audience,
  };

  try {
    return jwt.verify(token, env.jwt.accessSecret, options) as DecodedAccessToken;
  } catch (primaryError) {
    if (env.jwt.accessSecretPrevious) {
      try {
        return jwt.verify(token, env.jwt.accessSecretPrevious, options) as DecodedAccessToken;
      } catch {
        throw primaryError;
      }
    }
    throw primaryError;
  }
}
