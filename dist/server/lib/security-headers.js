"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withSecurityHeaders = withSecurityHeaders;
const server_1 = require("next/server");
/**
 * Adds recommended HTTP security headers to all API responses.
 * Usage: wrap your route handler with this function.
 */
function withSecurityHeaders(handler) {
    return async (req, ...args) => {
        const res = await handler(req, ...args);
        // If the handler returns a NextResponse, set headers directly
        if (res instanceof server_1.NextResponse) {
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
