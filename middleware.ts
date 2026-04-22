import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// ---------------------------------------------------------------------------
// Intl middleware — no locale prefix, Arabic only
// ---------------------------------------------------------------------------
const intlMiddleware = createIntlMiddleware({
  locales: ["ar"],
  defaultLocale: "ar",
  localePrefix: "never",
});

// ---------------------------------------------------------------------------
// Route classification
// ---------------------------------------------------------------------------
const PUBLIC_PATHS = ["/login", "/forgot-password"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const publicPath = isPublicPath(pathname);

  // Unauthenticated → login
  if (!user && !publicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((c) =>
      redirectResponse.cookies.set(c.name, c.value)
    );
    return redirectResponse;
  }

  // Authenticated on auth page → dashboard
  if (user && publicPath) {
    const redirectResponse = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.getAll().forEach((c) =>
      redirectResponse.cookies.set(c.name, c.value)
    );
    return redirectResponse;
  }

  // Run intl middleware
  const intlResponse = intlMiddleware(request);
  intlResponse.headers.set("x-pathname", pathname);
  response.cookies.getAll().forEach((c) =>
    intlResponse.cookies.set(c.name, c.value)
  );

  return intlResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)" ],
};
