import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Discord now adds an `iss` query param to the OAuth callback. next-auth v4's
// openid-client throws "issuer must be configured on the issuer" when it sees
// `iss` but the hand-configured Discord provider has no issuer metadata to
// check it against. Stripping the param before NextAuth's handler runs avoids
// the check entirely. See https://github.com/nextauthjs/next-auth/issues/9826
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  if (url.searchParams.has("iss")) {
    url.searchParams.delete("iss");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/auth/callback/discord",
};
