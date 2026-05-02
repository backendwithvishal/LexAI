/**
 * Route-Level Tests — Analysis DELETE Endpoints
 *
 * Tests RBAC enforcement and ObjectId param validation without hitting
 * a real database. Auth, orgResolver, and the analysis service are all mocked.
 *
 * Property 4: Invalid ObjectId parameter returns 400
 * Validates: Requirements 1.6, 1.7, 2.5, 2.6
 */

import { jest } from '@jest/globals';
import { testProp, fc } from '@fast-check/jest';
import express from 'express';
import request from 'supertest';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** A valid 24-char hex ObjectId */
const VALID_ID = '64a1b2c3d4e5f6a7b8c9d0e1';

/** Generate strings that are NOT valid 24-char hex ObjectIds */
const fcNonObjectId = () =>
    fc.string({ minLength: 1, maxLength: 50 }).filter(
        (s) => !/^[0-9a-fA-F]{24}$/.test(s)
    );

// ─── Mock setup ───────────────────────────────────────────────────────────────

// Mock auth middleware — injects req.user and req.orgId directly
jest.unstable_mockModule('../../../src/middleware/auth.middleware.js', () => ({
    authenticate: (req, _res, next) => {
        req.user = { userId: 'user1', orgId: 'org1', role: req._testRole ?? 'manager' };
        next();
    },
}));

jest.unstable_mockModule('../../../src/middleware/orgResolver.middleware.js', () => ({
    requireOrg: (req, _res, next) => {
        req.orgId = req.user.orgId;
        next();
    },
}));

// Mock rate limiter and quota — pass through
jest.unstable_mockModule('../../../src/middleware/rateLimiter.middleware.js', () => ({
    rateLimiter: () => (_req, _res, next) => next(),
}));

jest.unstable_mockModule('../../../src/middleware/quota.middleware.js', () => ({
    checkQuota: (_req, _res, next) => next(),
}));

// Mock analysis service — return success for all delete calls
jest.unstable_mockModule('../../../src/services/analysis.service.js', () => ({
    requestAnalysis: jest.fn(),
    getAnalysis: jest.fn(),
    getAnalysesByContract: jest.fn(),
    deleteAnalysis: jest.fn().mockResolvedValue({ analysisId: VALID_ID }),
    deleteAnalysesByContract: jest.fn().mockResolvedValue({ deletedCount: 1 }),
}));

// Import router AFTER mocks are registered
const { default: analysisRouter } = await import('../../../src/routes/analysis.routes.js');

// ─── App factory ──────────────────────────────────────────────────────────────

/**
 * Build a minimal Express app with the analysis router mounted.
 * Accepts an optional role override so we can test viewer vs manager.
 */
function buildApp(role = 'manager') {
    const app = express();
    app.use(express.json());

    // Inject role into req before the router runs
    app.use((req, _res, next) => {
        req._testRole = role;
        next();
    });

    app.use('/api/v1/analyses', analysisRouter);
    return app;
}

// ─── RBAC tests ───────────────────────────────────────────────────────────────

describe('RBAC: viewer role is rejected with 403', () => {
    const app = buildApp('viewer');

    it('DELETE /analyses/:id → 403 for viewer', async () => {
        const res = await request(app).delete(`/api/v1/analyses/${VALID_ID}`);
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('DELETE /analyses/contract/:contractId → 403 for viewer', async () => {
        const res = await request(app).delete(`/api/v1/analyses/contract/${VALID_ID}`);
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('FORBIDDEN');
    });
});

describe('RBAC: manager role is allowed through', () => {
    const app = buildApp('manager');

    it('DELETE /analyses/:id → 200 for manager', async () => {
        const res = await request(app).delete(`/api/v1/analyses/${VALID_ID}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('DELETE /analyses/contract/:contractId → 200 for manager', async () => {
        const res = await request(app).delete(`/api/v1/analyses/contract/${VALID_ID}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

describe('RBAC: admin role is allowed through', () => {
    const app = buildApp('admin');

    it('DELETE /analyses/:id → 200 for admin', async () => {
        const res = await request(app).delete(`/api/v1/analyses/${VALID_ID}`);
        expect(res.status).toBe(200);
    });

    it('DELETE /analyses/contract/:contractId → 200 for admin', async () => {
        const res = await request(app).delete(`/api/v1/analyses/contract/${VALID_ID}`);
        expect(res.status).toBe(200);
    });
});

// ─── Property 4: Invalid ObjectId → 400 ──────────────────────────────────────

describe('Property 4: Invalid ObjectId parameter returns 400', () => {
    const app = buildApp('manager');

    testProp(
        'DELETE /analyses/:id returns 400 for any non-ObjectId :id',
        [fcNonObjectId()],
        async (badId) => {
            const res = await request(app).delete(`/api/v1/analyses/${encodeURIComponent(badId)}`);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        },
        { numRuns: 30 }
    );

    testProp(
        'DELETE /analyses/contract/:contractId returns 400 for any non-ObjectId :contractId',
        [fcNonObjectId()],
        async (badId) => {
            const res = await request(app).delete(`/api/v1/analyses/contract/${encodeURIComponent(badId)}`);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        },
        { numRuns: 30 }
    );
});
