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

// Function to check if path requires admin access
const requiresAdmin = (pathname: string): boolean => {
  return pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
};

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow public paths
  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // Special handling for user registration endpoint
  if (pathname === '/api/users' && request.method === 'POST') {
    // Allow authenticated users to register (they have token but no complete user record)
    const authToken = request.cookies.get('auth-token')?.value;
    if (authToken) {
      try {
        // Just verify the token is valid, don't check user completeness
        const verifyResponse = await fetch(`${request.nextUrl.origin}/api/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: authToken }),
        });
        
        if (verifyResponse.ok) {
          return NextResponse.next(); // Allow registration
        }
      } catch (error) {
        // Fall through to normal auth flow
      }
    }
  }

  const authToken = request.cookies.get('auth-token')?.value;

  // Redirect to sign in if no auth token
  if (!authToken) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
  }

  try {
    // Verify token
    const verifyResponse = await fetch(`${request.nextUrl.origin}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: authToken }),
    });

    if (!verifyResponse.ok) {
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(signInUrl);
    }

    // Get user data
    const userResponse = await fetch(`${request.nextUrl.origin}/api/users/me`, {
      headers: { 'Cookie': `auth-token=${authToken}` }
    });

    if (!userResponse.ok) {
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(signInUrl);
    }

    const userData = await userResponse.json();

    // Check if user registration is complete
    if (!userData || !userData.firstName || !userData.lastName) {
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(signInUrl);
    }

    // Check admin access for admin routes
    if (requiresAdmin(pathname) && !userData.isAdmin) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
  } catch (error) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
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