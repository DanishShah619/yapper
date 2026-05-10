"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendConnectionRequestSchema = exports.loginSchema = exports.registerSchema = void 0;
exports.validateInput = validateInput;
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    username: zod_1.z.string().min(3).max(32),
    password: zod_1.z.string().min(8),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
});
exports.sendConnectionRequestSchema = zod_1.z.object({
    username: zod_1.z.string().min(3).max(32),
});
// Add more schemas as needed for other mutations and endpoints
function validateInput(schema, data) {
    const result = schema.safeParse(data);
    if (!result.success) {
        throw new Error(result.error.issues.map((e) => e.message).join('; '));
    }
    return result.data;
}
