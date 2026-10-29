import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Se variáveis não estiverem configuradas, permitir rota de login para exibir aviso amigável
  if (!supabaseUrl || !supabaseAnonKey) {
    if (request.nextUrl.pathname !== "/login" && !request.nextUrl.pathname.startsWith("/api/webhooks")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname === "/login";
  const isWebhook = request.nextUrl.pathname.startsWith("/api/webhooks");

  // Ignorar webhooks da proteção de sessão
  if (isWebhook) {
    return response;
  }

  // Não logado tentando acessar área protegida -> redireciona para login
  if (!user && !isLoginPage) {
    const redirectUrl = new URL("/login", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // Usuário já logado tentando acessar login -> redireciona para o dashboard
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|booking-push-sw\\.js|manifest\\.webmanifest|sounds/|pwa/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
