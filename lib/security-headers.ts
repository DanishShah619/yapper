import { NextRequest, NextResponse } from 'next/server';

/**
 * Adds recommended HTTP security headers to all API responses.
 * Usage: wrap your route handler with this function.
 */
export function withSecurityHeaders(handler: (req: NextRequest, ...args: any[]) => Promise<Response> | Response) {
  return async (req: NextRequest, ...args: any[]) => {
    const res = await handler(req, ...args);
    // If the handler returns a NextResponse, set headers directly
    if (res instanceof NextResponse) {
      res.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; object-src 'none';");
      res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
      res.headers.set('X-Content-Type-Options', 'nosniff');
      res.headers.set('X-Frame-Options', 'DENY');
      res.headers.set('Referrer-Policy', 'same-origin');
      res.headers.set('Permissions-Policy', 'geolocation=(), microphone=()');
      return res;
    }
    // If the handler returns a plain Response, clone and set headers
    const newRes = new Response(res.body, res);
    newRes.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; object-src 'none';");
    newRes.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    newRes.headers.set('X-Content-Type-Options', 'nosniff');
    newRes.headers.set('X-Frame-Options', 'DENY');
    newRes.headers.set('Referrer-Policy', 'same-origin');
    newRes.headers.set('Permissions-Policy', 'geolocation=(), microphone=()');
    return newRes;
  };
}
