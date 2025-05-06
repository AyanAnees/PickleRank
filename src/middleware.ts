import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// List of paths that don't require authentication
const publicPaths = [
  '/',
  '/auth/signin',
  '/api/auth/signin',
  '/api/auth/verify',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response: NextResponse;

  // Allow public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    response = NextResponse.next();
  } else {
    // Check for authentication token
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      // Redirect to sign in page if no token
      const url = new URL('/auth/signin', request.url);
      url.searchParams.set('from', pathname);
      return NextResponse.redirect(url);
    }

    try {
      // Verify the token by calling our API
      const verifyResponse = await fetch(`${request.nextUrl.origin}/api/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken: token }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Invalid token');
      }

      response = NextResponse.next();
    } catch (error) {
      // Clear invalid token and redirect to sign in
      response = NextResponse.redirect(new URL('/auth/signin', request.url));
      response.cookies.delete('auth-token');
      return response;
    }
  }

  // Add CSP headers
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com/recaptcha/ https://www.recaptcha.net/ https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://www.googletagmanager.com/ https://www.google-analytics.com/ https://firebase.googleapis.com/ https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/; " +
    "frame-src 'self' https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/ https://www.recaptcha.net/recaptcha/ https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://identitytoolkit.googleapis.com/ https://securetoken.googleapis.com/ https://firestore.googleapis.com/ https://firebasestorage.googleapis.com/ https://firebase.googleapis.com/ https://www.google-analytics.com/ https://region1.google-analytics.com/ https://analytics.google.com/ https://*.firebase.googleapis.com/ https://*.firebaseio.com/ https://*.firebase.com/ https://www.google.com/recaptcha/ https://www.recaptcha.net/ https://www.gstatic.com/recaptcha/ https://recaptcha.google.com/recaptcha/;"
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 