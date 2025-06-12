import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define public paths that don't require authentication
const publicPaths = [
  '/',
  '/auth/signin',
  '/terms',
  '/privacy',
  '/api/auth/verify',
  '/api/users/me'
];

// Define paths that require admin access
const adminPaths = [
  '/admin',
  '/api/admin'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log(`[Middleware] Processing request for path: ${pathname}`);

  // Allow public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    console.log(`[Middleware] Public path accessed: ${pathname}`);
    return NextResponse.next();
  }

  // Check for auth token
  const authToken = request.cookies.get('auth-token')?.value;
  console.log(`[Middleware] Auth token present: ${!!authToken}`);

  // If no auth token and trying to access protected route, redirect to sign in
  if (!authToken) {
    console.log(`[Middleware] No auth token found, redirecting to sign in from: ${pathname}`);
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(signInUrl);
  }

  try {
    console.log(`[Middleware] Verifying token for path: ${pathname}`);
    // First verify the token
    const verifyResponse = await fetch(`${request.nextUrl.origin}/api/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken: authToken }),
    });

    console.log(`[Middleware] Token verification status: ${verifyResponse.status}`);

    if (!verifyResponse.ok) {
      console.log(`[Middleware] Token verification failed with status: ${verifyResponse.status}`);
      // Clear invalid token and redirect to sign in
      const response = NextResponse.redirect(new URL('/auth/signin', request.url));
      response.cookies.delete('auth-token');
      return response;
    }

    console.log(`[Middleware] Fetching user data for path: ${pathname}`);
    // Then get user data
    const userResponse = await fetch(`${request.nextUrl.origin}/api/users/me`, {
      headers: {
        'Cookie': `auth-token=${authToken}`
      }
    });

    console.log(`[Middleware] User data fetch status: ${userResponse.status}`);

    if (!userResponse.ok) {
      console.log(`[Middleware] User data fetch failed with status: ${userResponse.status}`);
      // Clear invalid token and redirect to sign in
      const response = NextResponse.redirect(new URL('/auth/signin', request.url));
      response.cookies.delete('auth-token');
      return response;
    }

    const userData = await userResponse.json();
    console.log(`[Middleware] User data retrieved: ${JSON.stringify({
      hasFirstName: !!userData?.firstName,
      hasLastName: !!userData?.lastName,
      isAdmin: !!userData?.isAdmin
    })}`);

    // Check if registration is complete
    if (!userData || !userData.firstName || !userData.lastName) {
      console.log(`[Middleware] Incomplete user registration data`);
      // Clear token and redirect to sign in
      const response = NextResponse.redirect(new URL('/auth/signin', request.url));
      response.cookies.delete('auth-token');
      return response;
    }

    // Check admin access for admin routes
    if (adminPaths.some(path => pathname.startsWith(path)) && !userData.isAdmin) {
      console.log(`[Middleware] Admin access denied for path: ${pathname}`);
      return NextResponse.redirect(new URL('/', request.url));
    }

    // All checks passed, allow access
    console.log(`[Middleware] Access granted for path: ${pathname}`);
    const response = NextResponse.next();
    
    // Refresh the token in the cookie
    response.cookies.set('auth-token', authToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });
    
    return response;
  } catch (error) {
    console.error('[Middleware] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      path: pathname
    });
    // Clear token and redirect to sign in on any error
    const response = NextResponse.redirect(new URL('/auth/signin', request.url));
    response.cookies.delete('auth-token');
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}; 