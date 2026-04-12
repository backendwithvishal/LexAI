/**
 * AI Routes
 *
 * Base path: /api/v1/ai  (mounted in routes/index.js)
 *
 * All endpoints require authentication + a valid org context.
 * AI endpoints have a stricter rate limit (10 req/min) since
 * each call consumes LLM tokens.
 *
 *   POST /ai/summarize-clause       — Summarize a single clause in plain English
 *   POST /ai/ask                    — Ask a question about a contract (Q&A chat)
 *   POST /ai/extract-terms          — Extract key terms, parties, and definitions
 *   POST /ai/explain-risk           — Explain an analysis risk score
 *   POST /ai/translate              — Translate analysis into another language
 *   POST /ai/compliance             — Check contract against a compliance framework
 *   GET  /ai/providers              — Get AI provider configuration status
 */

import { Router } from 'express';
import * as aiController from '../controllers/ai.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireOrg } from '../middleware/orgResolver.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { rateLimiter } from '../middleware/rateLimiter.middleware.js';
import * as aiValidator from '../validators/ai.validator.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const router = Router();

// All AI routes require authentication + org membership
router.use(authenticate, requireOrg);

// Stricter rate limit for AI endpoints — 10 req/min per user
const aiRateLimit = rateLimiter('ai');

// ─── Clause Summarization ───────────────────────────────────────
router.post(
    '/summarize-clause',
    aiRateLimit,
    validate(aiValidator.summarizeClause),
    asyncWrapper(aiController.summarizeClause)
);

// ─── Contract Q&A ───────────────────────────────────────────────
router.post(
    '/ask',
    aiRateLimit,
    validate(aiValidator.askQuestion),
    asyncWrapper(aiController.askQuestion)
);

// ─── Key Terms Extraction ───────────────────────────────────────
router.post(
    '/extract-terms',
    aiRateLimit,
    validate(aiValidator.extractTerms),
    asyncWrapper(aiController.extractTerms)
);

// ─── Risk Explanation ───────────────────────────────────────────
router.post(
    '/explain-risk',
    aiRateLimit,
    validate(aiValidator.explainRisk),
    asyncWrapper(aiController.explainRisk)
);

// ─── Analysis Translation ───────────────────────────────────────
router.post(
    '/translate',
    aiRateLimit,
    validate(aiValidator.translateAnalysis),
    asyncWrapper(aiController.translateAnalysis)
);

// ─── Compliance Check ───────────────────────────────────────────
router.post(
    '/compliance',
    aiRateLimit,
    validate(aiValidator.checkCompliance),
    asyncWrapper(aiController.checkCompliance)
);

// ─── Provider Status (no rate limit — lightweight) ──────────────
router.get(
    '/providers',
    asyncWrapper(aiController.getProviderStatus)
);

export default router;
