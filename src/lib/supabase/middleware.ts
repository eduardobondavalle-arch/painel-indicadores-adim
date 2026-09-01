import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const isLoginPage = request.nextUrl.pathname === "/gestao";
  const isAdminApi = request.nextUrl.pathname.startsWith("/api/admin");
  const isProtected = request.nextUrl.pathname.startsWith("/gestao/") || isAdminApi;

  if (isProtected && !user) {
    if (isAdminApi) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    const login = request.nextUrl.clone();
    login.pathname = "/gestao";
    login.searchParams.set("retorno", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  if (isLoginPage && user) {
    const dashboard = request.nextUrl.clone();
    dashboard.pathname = "/gestao/visao-geral";
    dashboard.search = "";
    return NextResponse.redirect(dashboard);
  }
  return response;
}
