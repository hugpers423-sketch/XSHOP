import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const requestedNext = request.nextUrl.searchParams.get('next');
  const next = requestedNext?.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/profile';
  if (!clientId) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'google_not_configured');
    loginUrl.searchParams.set('next', next);
    return NextResponse.redirect(loginUrl);
  }

  const state = randomBytes(24).toString('hex');
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || new URL('/api/auth/google/callback', request.url).toString();
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('access_type', 'online');
  authUrl.searchParams.set('prompt', 'select_account');
  authUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  response.cookies.set('google_oauth_next', next, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return response;
}
