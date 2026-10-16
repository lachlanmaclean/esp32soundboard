import NextAuth from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

// Discord now adds an `iss` query param to the OAuth callback. next-auth v4's
// openid-client throws "issuer must be configured on the issuer" when it
// sees `iss` but this hand-configured Discord provider has no issuer
// metadata to validate it against. Stripped here, inside the same handler
// call NextAuth itself reads req.nextUrl from - not in middleware, since a
// separate redirect/rewrite hop there was dropping the state cookie and
// burning the single-use authorization code instead.
function withIssStripped(request: NextRequest): NextRequest {
  if (!request.nextUrl.searchParams.has("iss")) return request;
  const url = request.nextUrl.clone();
  url.searchParams.delete("iss");
  return new NextRequest(url, { headers: request.headers, method: request.method });
}

type RouteContext = { params: { nextauth: string[] } };

export async function GET(request: NextRequest, context: RouteContext) {
  return handler(withIssStripped(request), context);
}

export { handler as POST };
