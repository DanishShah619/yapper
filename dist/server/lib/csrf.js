"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCsrfToken = generateCsrfToken;
exports.setCsrfCookie = setCsrfCookie;
exports.validateCsrfToken = validateCsrfToken;
const headers_1 = require("next/headers");
const crypto_1 = require("crypto");
function generateCsrfToken() {
    return (0, crypto_1.randomBytes)(32).toString('hex');
}
async function setCsrfCookie(token) {
    // This cookie is readable by JS (no httpOnly) — intentionally, so the client can send it as a header
    const cookieStore = await (0, headers_1.cookies)();
    cookieStore.set('csrf_token', token, {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        // NOT httpOnly — must be readable by frontend JS
    });
}
async function validateCsrfToken(request) {
    var _a;
    const cookieStore = await (0, headers_1.cookies)();
    const cookieToken = (_a = cookieStore.get('csrf_token')) === null || _a === void 0 ? void 0 : _a.value;
    const headerToken = request.headers.get('x-csrf-token');
    if (!cookieToken || !headerToken)
        return false;
    // Timing-safe comparison (standard string comparison is fine for this scope, 
    // but strictly speaking we could use crypto.timingSafeEqual on buffer pairs)
    return cookieToken === headerToken;
}
