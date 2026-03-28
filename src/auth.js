import crypto from "node:crypto";
import { promisify } from "node:util";
import {
  createSession,
  createUser,
  deleteExpiredSessions,
  deleteSessionByTokenHash,
  getSessionByTokenHash,
  getUserByUsername,
  getUserCount,
  markUserLoggedIn
} from "./db.js";

const scryptAsync = promisify(crypto.scrypt);

const SESSION_COOKIE_NAME = "atmb_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const PBKDF_KEYLEN = 64;

export async function ensureDefaultAdmin() {
  if (getUserCount() > 0) {
    return;
  }

  const passwordHash = await hashPassword("admin");
  createUser({
    username: "admin",
    passwordHash,
    role: "admin",
    status: "active",
    mustChangePassword: true
  });
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt, PBKDF_KEYLEN);
  return `scrypt:${salt}:${Buffer.from(derivedKey).toString("hex")}`;
}

export async function verifyPassword(password, passwordHash) {
  const [scheme, salt, expected] = String(passwordHash || "").split(":");
  if (scheme !== "scrypt" || !salt || !expected) {
    return false;
  }

  const derivedKey = await scryptAsync(password, salt, PBKDF_KEYLEN);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(derivedKey);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function loginUser(username, password) {
  const user = getUserByUsername(username);
  if (!user || user.status !== "active") {
    return null;
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  deleteExpiredSessions();
  createSession(user.id, tokenHash, expiresAt);
  markUserLoggedIn(user.id);

  return {
    cookieValue: rawToken,
    expiresAt,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      mustChangePassword: user.mustChangePassword
    }
  };
}

export function logoutUser(rawToken) {
  if (!rawToken) {
    return;
  }

  deleteSessionByTokenHash(hashSessionToken(rawToken));
}

export function resolveUserFromCookie(cookieHeader) {
  deleteExpiredSessions();

  const cookies = parseCookieHeader(cookieHeader);
  const rawToken = cookies[SESSION_COOKIE_NAME];
  if (!rawToken) {
    return null;
  }

  const session = getSessionByTokenHash(hashSessionToken(rawToken));
  if (!session) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    deleteSessionByTokenHash(session.tokenHash);
    return null;
  }

  if (session.user.status !== "active") {
    deleteSessionByTokenHash(session.tokenHash);
    return null;
  }

  return {
    token: rawToken,
    expiresAt: session.expiresAt,
    user: session.user
  };
}

export function getSessionCookieHeader(rawToken, expiresAt) {
  return serializeCookie(SESSION_COOKIE_NAME, rawToken, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    expires: new Date(expiresAt)
  });
}

export function getExpiredSessionCookieHeader() {
  return serializeCookie(SESSION_COOKIE_NAME, "", {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    expires: new Date(0)
  });
}

function hashSessionToken(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function parseCookieHeader(headerValue) {
  const cookies = {};

  for (const part of String(headerValue || "").split(";")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    cookies[key] = decodeURIComponent(value);
  }

  return cookies;
}

function serializeCookie(name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  if (options.path) {
    segments.push(`Path=${options.path}`);
  }

  if (options.httpOnly) {
    segments.push("HttpOnly");
  }

  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }

  if (options.secure) {
    segments.push("Secure");
  }

  if (options.expires) {
    segments.push(`Expires=${options.expires.toUTCString()}`);
  }

  return segments.join("; ");
}
