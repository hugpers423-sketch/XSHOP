import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createSession, type AuthUser } from '@/lib/auth';
import { databaseConfigured, ensureExternalUser } from '@/lib/users';

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
}

interface GoogleProfile {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/login?error=google_not_configured', request.url));
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const cookieStore = await cookies();
  const expectedState = cookieStore.get('google_oauth_state')?.value;
  const next = cookieStore.get('google_oauth_next')?.value || '/profile';

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL('/login?error=google_invalid_state', request.url));
  }

  try {
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || new URL('/api/auth/google/callback', request.url).toString();
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      cache: 'no-store',
    });
    const token = (await tokenResponse.json()) as GoogleTokenResponse;
    if (!tokenResponse.ok || !token.access_token) {
      return NextResponse.redirect(new URL('/login?error=google_failed', request.url));
    }

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: 'no-store',
    });
    const profile = (await profileResponse.json()) as GoogleProfile;
    if (!profileResponse.ok || !profile.sub || !profile.email || profile.email_verified === false) {
      return NextResponse.redirect(new URL('/login?error=google_profile', request.url));
    }

    const identity = {
      googleSub: String(profile.sub),
      email: profile.email.toLowerCase(),
      name: profile.name || profile.email.split('@')[0],
      avatar: profile.picture || null,
    };
    let user: AuthUser = {
      id: `google:${identity.googleSub}`,
      name: identity.name,
      email: identity.email,
      role: 'BUYER',
      xCoins: 0,
    };
    if (databaseConfigured()) {
      user = await ensureExternalUser({ ...identity, role: 'BUYER' });
    } else if (process.env.NODE_ENV === 'production') {
      return NextResponse.redirect(new URL('/login?error=database_not_configured', request.url));
    }
    await createSession(user);
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/profile';
    const response = NextResponse.redirect(new URL(safeNext, request.url));
    response.cookies.delete('google_oauth_state');
    response.cookies.delete('google_oauth_next');
    return response;
  } catch {
    return NextResponse.redirect(new URL('/login?error=google_failed', request.url));
  }
}
