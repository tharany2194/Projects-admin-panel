import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function getHomeByRole(role?: string) {
  if (role === "client") return "/client/dashboard";
  return "/dashboard";
}

function hasAllowedPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const publicPaths = ["/login", "/signup"];
  const isPublicPath = publicPaths.includes(pathname);

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (token && isPublicPath) {
    return NextResponse.redirect(new URL(getHomeByRole(token.role as string), req.url));
  }

  if (!token) return NextResponse.next();

  const role = (token.role as string) || "";

  if (role === "client") {
    const clientAllowed = ["/client", "/notifications/subscribe"];
    if (!hasAllowedPrefix(pathname, clientAllowed)) {
      return NextResponse.redirect(new URL(getHomeByRole(role), req.url));
    }
    return NextResponse.next();
  }

  if (hasAllowedPrefix(pathname, ["/client"])) {
    return NextResponse.redirect(new URL(getHomeByRole(role), req.url));
  }

  const roleAllowed: Record<string, string[]> = {
    admin: [
      "/",
      "/dashboard",
      "/clients",
      "/projects",
      "/quotations",
      "/invoices",
      "/tasks",
      "/team",
      "/notifications",
      "/reports",
      "/settings",
    ],
    sales: [
      "/",
      "/dashboard",
      "/clients",
      "/projects",
      "/quotations",
      "/invoices",
      "/tasks",
      "/settings",
    ],
    developer: [
      "/",
      "/dashboard",
      "/projects",
      "/tasks",
      "/settings",
    ],
  };

  const allowedPrefixes = roleAllowed[role] || ["/dashboard"];
  if (!hasAllowedPrefix(pathname, allowedPrefixes)) {
    return NextResponse.redirect(new URL(getHomeByRole(role), req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|axelera-logo.png).*)",
  ],
};
