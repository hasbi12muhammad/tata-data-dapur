import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPathAllowed } from "@/lib/features/entitlements";

// Karyawan hanya boleh ke halaman operasional. Halaman lain (dashboard laba, laporan,
// resep/HPP, pengeluaran, pengaturan) tertutup permanen. Data tetap dijaga RLS/RPC di DB.
const STAFF_PATHS = ["/sales", "/kasir", "/items", "/produksi", "/purchases", "/offline", "/help", "/tutorial"];

async function isStaff(supabase: { auth: { getSession(): Promise<{ data: { session: { access_token: string } | null } }> } }) {
  const t = (await supabase.auth.getSession()).data.session?.access_token;
  if (!t) return false;
  const p = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(p)).role === "staff";
}

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // If credentials missing, treat as unauthenticated
    if (!url || !key) {
      if (pathname === "/login" || pathname === "/") {
        return NextResponse.next({ request });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }

    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    let user = null;
    try {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      // Supabase unreachable — treat as unauthenticated
    }

    // Public routes — no auth or version check needed
    if (
      pathname === "/login" ||
      pathname === "/unauthorized" ||
      pathname === "/welcome" ||
      pathname.startsWith("/api/borderpay/")
    ) {
      if (user && pathname === "/login") {
        const home = (await isStaff(supabase)) ? "/sales" : "/dashboard";
        return NextResponse.redirect(new URL(home, request.url));
      }
      return NextResponse.next({ request });
    }

    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // getUser() di atas sudah memvalidasi token ke server, klaim aman dibaca.
    if (await isStaff(supabase)) {
      const ok = STAFF_PATHS.some((r) => pathname === r || pathname.startsWith(r + "/"));
      if (!ok || !isPathAllowed(pathname)) {
        return NextResponse.redirect(new URL("/sales", request.url));
      }
      return supabaseResponse;
    }

    if (pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Feature gating — block routes whose feature is not part of this
    // deployment's package (env-driven, see lib/features/entitlements).
    if (!isPathAllowed(pathname)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return supabaseResponse;
  } catch {
    // Last-resort: never return 500 from middleware
    const { pathname } = request.nextUrl;
    if (pathname === "/login" || pathname === "/welcome" || pathname.startsWith("/api/borderpay/")) {
      return NextResponse.next({ request });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons).*)",
  ],
};
