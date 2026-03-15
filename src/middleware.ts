import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Guard: if Supabase env vars are not configured, skip middleware entirely
// (allows local dev to work without real credentials)
const SUPABASE_CONFIGURED =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "your_supabase_project_url" &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "your_supabase_anon_key";

export async function middleware(request: NextRequest) {
    // Skip all auth logic if Supabase is not configured yet (local dev without credentials)
    if (!SUPABASE_CONFIGURED) {
        return NextResponse.next({ request });
    }

    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh session on every request to keep auth alive
    const { data: { user } } = await supabase.auth.getUser();

    // Protect history routes — redirect unauthenticated users to /login
    const protectedRoutes = ["/history"];
    const isProtected = protectedRoutes.some((route) =>
        request.nextUrl.pathname.startsWith(route)
    );

    if (isProtected && !user) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/login";
        return NextResponse.redirect(loginUrl);
    }

    // Redirect already-logged-in users away from auth pages
    const authRoutes = ["/login", "/signup"];
    const isAuthRoute = authRoutes.includes(request.nextUrl.pathname);

    if (isAuthRoute && user) {
        const homeUrl = request.nextUrl.clone();
        homeUrl.pathname = "/";
        return NextResponse.redirect(homeUrl);
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
