import { NextResponse } from 'next/server';
export function middleware() {
  // CSP in report-only mode for staging
  const csp = "default-src 'self'; img-src 'self' data: https://*.r2.cloudflarestorage.com; connect-src 'self' https://*.supabase.co;";
  const res = NextResponse.next();
  // Use Report-Only to avoid breaking staging
  res.headers.set('Content-Security-Policy-Report-Only', csp);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'no-referrer-when-downgrade');
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
