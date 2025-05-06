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

  // Allow public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for auth token
  const authToken = request.cookies.get('auth-token')?.value;

  // If no auth token and trying to access protected route, redirect to sign in
  if (!authToken) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(signInUrl);
  }

  try {
    // First verify the token
    const verifyResponse = await fetch(`${request.nextUrl.origin}/api/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken: authToken }),
    });

    if (!verifyResponse.ok) {
      // Clear invalid token and redirect to sign in
      const response = NextResponse.redirect(new URL('/auth/signin', request.url));
      response.cookies.delete('auth-token');
      return response;
    }

    // Then get user data
    const userResponse = await fetch(`${request.nextUrl.origin}/api/users/me`, {
      headers: {
        'Cookie': `auth-token=${authToken}`
      }
    });

    if (!userResponse.ok) {
      // Clear invalid token and redirect to sign in
      const response = NextResponse.redirect(new URL('/auth/signin', request.url));
      response.cookies.delete('auth-token');
      return response;
    }

    const userData = await userResponse.json();

    // Check if registration is complete
    if (!userData || !userData.firstName || !userData.lastName) {
      // Clear token and redirect to sign in
      const response = NextResponse.redirect(new URL('/auth/signin', request.url));
      response.cookies.delete('auth-token');
      return response;
    }

    // Check admin access for admin routes
    if (adminPaths.some(path => pathname.startsWith(path)) && !userData.isAdmin) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // All checks passed, allow access
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
    console.error('Middleware error:', error);
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