/**
 * Sanitization Middleware
 *
 * Two layers of protection:
 *
 * 1. xssSanitizer — strips XSS payloads from all string values in
 *    req.body, req.query, and req.params using the `xss` library.
 *
 * 2. depthLimiter — rejects requests whose JSON body is nested deeper
 *    than MAX_DEPTH levels. Prevents prototype pollution and ReDoS
 *    attacks via deeply nested objects.
 *
 * Register both AFTER body parsing and BEFORE route handlers.
 */

import xss from 'xss';
import { sendError } from '../utils/apiResponse.js';
import HTTP from '../constants/httpStatus.js';

// Maximum allowed nesting depth for JSON request bodies
const MAX_DEPTH = 10;

/**
 * Recursively sanitize all string values in an object.
 * Handles nested objects and arrays.
 */
function sanitizeValue(obj) {
    if (typeof obj === 'string') {
        return xss(obj, {
            whiteList: {},          // Strip ALL HTML tags — this is an API, not a CMS
            stripIgnoreTag: true,
            stripIgnoreTagBody: ['script', 'style'],
        });
    }
    if (Array.isArray(obj)) return obj.map(sanitizeValue);
    if (obj && typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeValue(value);
        }
        return sanitized;
    }
    return obj;
}

/**
 * Measure the maximum nesting depth of an object/array.
 */
function getDepth(obj, current = 0) {
    if (current > MAX_DEPTH) return current; // Short-circuit
    if (Array.isArray(obj)) {
        return obj.reduce((max, item) => Math.max(max, getDepth(item, current + 1)), current);
    }
    if (obj && typeof obj === 'object') {
        return Object.values(obj).reduce(
            (max, val) => Math.max(max, getDepth(val, current + 1)),
            current
        );
    }
    return current;
}

/**
 * XSS sanitizer — cleans all string values in body, query, and params.
 */
export function xssSanitizer(req, res, next) {
    if (req.body)   req.body   = sanitizeValue(req.body);
    if (req.query)  req.query  = sanitizeValue(req.query);
    if (req.params) req.params = sanitizeValue(req.params);
    next();
}

/**
 * Depth limiter — rejects overly nested JSON bodies.
 * Prevents prototype pollution and CPU-exhaustion attacks.
 */
export function depthLimiter(req, res, next) {
    if (req.body && typeof req.body === 'object') {
        if (getDepth(req.body) > MAX_DEPTH) {
            return sendError(res, {
                statusCode: HTTP.BAD_REQUEST,
                code: 'PAYLOAD_TOO_DEEP',
                message: `Request body nesting exceeds the maximum allowed depth of ${MAX_DEPTH}.`,
            });
        }
    }
    next();
}
