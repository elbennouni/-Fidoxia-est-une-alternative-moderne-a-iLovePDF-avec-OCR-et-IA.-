import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifySession } from "@/lib/session";

const PUBLIC_PATHS = new Set([
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
  "/",
]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? await verifySession(token) : null;

  if (pathname.startsWith("/api")) {
    if (PUBLIC_PATHS.has(pathname)) {
      return NextResponse.next();
    }
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname)) {
    if (payload && (pathname === "/login" || pathname === "/register" || pathname === "/")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!payload) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)"],
};
