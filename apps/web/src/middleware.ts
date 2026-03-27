import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = [
  "/dashboard",
  "/admin",
  "/automation",
  "/profile",
  "/resumes",
  "/jobs",
  "/applications",
  "/analytics",
  "/settings",
];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has("hf_access_token");
  if (hasSession) {
    return NextResponse.next();
  }

  const loginPath = request.nextUrl.clone();
  loginPath.pathname = "/login";
  loginPath.search = "";
  loginPath.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginPath);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/automation/:path*",
    "/profile/:path*",
    "/resumes/:path*",
    "/jobs/:path*",
    "/applications/:path*",
    "/analytics/:path*",
    "/settings/:path*",
  ],
};