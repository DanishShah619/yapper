"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
exports.extractToken = extractToken;
exports.validateSession = validateSession;
const jwt = __importStar(require("jsonwebtoken"));
const crypto_1 = require("crypto");
const session_1 = require("./session");
const env_1 = require("./env");
const JWT_SECRET = env_1.env.JWT_SECRET || 'nexchat-dev-secret-change-in-production-2025';
const JWT_EXPIRES_IN = env_1.env.JWT_EXPIRES_IN;
/**
 * Generate a signed JWT for a user.
 */
function generateToken(userId) {
    return jwt.sign({ userId }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
        jwtid: (0, crypto_1.randomUUID)(),
    });
}
/**
 * Verify and decode a JWT. Returns the payload or null if invalid/expired.
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    }
    catch (_a) {
        return null;
    }
}
/**
 * Extract Bearer token from an Authorization header string.
 */
function extractToken(authHeader) {
    if (!authHeader)
        return null;
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer')
        return null;
    return parts[1];
}
/**
 * Validate a token against Redis session cache.
 * Returns the userId if valid, or null if the session was invalidated.
 */
async function validateSession(token) {
    const payload = verifyToken(token);
    if (!payload)
        return null;
    // Check if session still exists in Redis (not logged out)
    const cachedToken = await (0, session_1.getSession)(payload.userId, token);
    if (!cachedToken || cachedToken !== token)
        return null;
    return payload.userId;
}
