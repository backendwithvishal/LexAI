/**
 * Express App Setup
 *
 * Configures all middleware, security headers, and routes.
 * Does NOT start the server — that's done in server.js.
 *
 * NOTE: `express-async-errors` is imported for its side effect —
 * it patches Express to catch unhandled promise rejections in
 * route handlers, making asyncWrapper optional but still useful
 * for explicit error handling.
 */

import 'express-async-errors';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import cookieParser from 'cookie-parser';
import hpp from 'hpp';

import routes from './routes/index.js';
import healthRoutes from './routes/health.routes.js';
import { rateLimiter } from './middleware/rateLimiter.middleware.js';
import { xssSanitizer, depthLimiter } from './middleware/sanitize.middleware.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';
import { attachRequestId, httpLogger } from './middleware/requestLogger.middleware.js';
import env from './config/env.js';

export default function createApp() {
    const app = express();

    // Trust first proxy — required for correct IP detection behind Docker/nginx
    // Without this, req.ip is always the proxy IP, breaking rate limiting
    app.set('trust proxy', 1);

    // Disable X-Powered-By header (don't advertise Express)
    app.disable('x-powered-by');

    // ─── Security Headers (Helmet) ──────────────────────────────────
    app.use(helmet({
        // Content Security Policy — restrict resource loading
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
                upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
            },
        },
        // HTTP Strict Transport Security — force HTTPS for 1 year in production
        hsts: env.NODE_ENV === 'production'
            ? { maxAge: 31536000, includeSubDomains: true, preload: true }
            : false,
        // Prevent MIME type sniffing
        noSniff: true,
        // Prevent clickjacking
        frameguard: { action: 'deny' },
        // Disable DNS prefetching
        dnsPrefetchControl: { allow: false },
        // Referrer policy — don't leak URL info
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
        // Disable browser features not needed by this API
        permittedCrossDomainPolicies: { permittedPolicies: 'none' },
        crossOriginEmbedderPolicy: false, // API doesn't serve embedded content
    }));

    // ─── CORS ───────────────────────────────────────────────────────
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
    app.use(cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (mobile apps, curl, Postman)
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            callback(new Error(`CORS: origin '${origin}' not allowed`));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
        exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
        maxAge: 86400, // Cache preflight for 24h
    }));

    // ─── Response Compression ───────────────────────────────────────
    // Gzip compress responses > 1kb — reduces bandwidth significantly
    app.use(compression({
        level: 6,           // Balanced speed vs compression ratio
        threshold: 1024,    // Only compress responses > 1kb
        filter: (req, res) => {
            // Don't compress if client explicitly opts out
            if (req.headers['x-no-compression']) return false;
            return compression.filter(req, res);
        },
    }));

    // ─── NoSQL Injection Prevention ─────────────────────────────────
    // Strips $ and . from keys to prevent MongoDB operator injection
    app.use(mongoSanitize({ replaceWith: '_' }));

    // ─── HTTP Parameter Pollution Prevention ────────────────────────
    // Prevents attacks like ?role=user&role=admin
    app.use(hpp());

    // ─── Parsing Middleware ─────────────────────────────────────────
    // Strict 100kb limit for JSON — prevents large payload DoS
    app.use(express.json({
        limit: '100kb',
        strict: true, // Only accept arrays and objects at top level
    }));
    app.use(express.urlencoded({ extended: false, limit: '100kb' }));
    app.use(cookieParser());

    // ─── XSS Sanitization + Depth Limiting ─────────────────────────
    app.use(depthLimiter);
    app.use(xssSanitizer);

    // ─── Request Logging ────────────────────────────────────────────
    app.use(attachRequestId);
    app.use(httpLogger);

    // ─── Global Rate Limiting ───────────────────────────────────────
    app.use(rateLimiter());

    // ─── Health Check (unauthenticated, no rate limit) ──────────────
    app.use('/health', healthRoutes);

    // ─── API Routes ─────────────────────────────────────────────────
    app.use(`/api/${env.API_VERSION}`, routes);

    // ─── 404 Handler ────────────────────────────────────────────────
    app.use((req, res) => {
        res.status(404).json({
            success: false,
            error: {
                code: 'NOT_FOUND',
                message: `Route ${req.method} ${req.originalUrl} not found.`,
            },
        });
    });

    // ─── Global Error Handler (must be last) ────────────────────────
    app.use(errorHandler);

    return app;
}
