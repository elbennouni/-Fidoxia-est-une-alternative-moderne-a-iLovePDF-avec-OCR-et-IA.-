import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const SECRET = process.env.AUTH_SECRET ?? "dev-insecure-secret-change-this";
const KEY = new TextEncoder().encode(SECRET);
const COOKIE_NAME = "video_saas_session";
export const AUTH_COOKIE_NAME = COOKIE_NAME;

type SessionPayload = {
  sub: string;
  email: string;
  name: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(KEY);
}

export async function createSessionToken(payload: {
  userId: string;
  email: string;
  name: string;
}) {
  return createSession({
    sub: payload.userId,
    email: payload.email,
    name: payload.name,
  });
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionPayload() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, KEY);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, KEY);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  return requireUser();
}

export async function requireUserId(_request?: Request) {
  const user = await requireUser();
  return user?.id ?? null;
}

export async function getAuthenticatedUserId() {
  const user = await requireUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user.id;
}

export async function getCurrentUserId() {
  const user = await requireUser();
  return user?.id ?? null;
}

export async function getUserFromRequest(_request?: Request) {
  return requireUser();
}

export async function getAuthUserFromRequest(_request?: Request) {
  return requireUser();
}

export async function ensureAuth() {
  const user = await requireUser();
  if (!user) return null;
  return { userId: user.id, email: user.email, name: user.name };
}

export async function signAuthToken(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) {
    throw new Error("User not found");
  }
  return createSession({ sub: user.id, email: user.email, name: user.name });
}

export async function getCurrentUserOrThrow() {
  const user = await requireUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function requireUser() {
  const session = await getSessionPayload();
  if (!session?.sub) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true },
  });
  return user;
}
