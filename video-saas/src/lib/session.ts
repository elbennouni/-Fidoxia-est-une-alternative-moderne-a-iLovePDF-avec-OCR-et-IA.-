import { jwtVerify, SignJWT } from "jose";

const SECRET = process.env.AUTH_SECRET ?? "dev-insecure-secret-change-this";
const KEY = new TextEncoder().encode(SECRET);

export const AUTH_COOKIE_NAME = "video_saas_session";

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
};

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(KEY);
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, KEY);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
