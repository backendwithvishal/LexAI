/**
 * Enrichment Routes
 *
 * Base path: /api/v1/enrichment  (mounted in routes/index.js)
 *
 * All endpoints require authentication.
 * These are non-critical — they return null/empty on external API failure
 * so the frontend can gracefully degrade.
 *
 * External APIs used (all free, no key required unless noted):
 *   REST Countries  — country/jurisdiction info
 *   World Time API  — timezone-aware current time
 *   Nager.Date      — public holidays for 90+ countries
 *   IPinfo          — IP geolocation (optional token for higher rate limit)
 *   EVA + Disify    — email validation + disposable email detection
 *   HIBP            — email breach check (requires HIBP_API_KEY)
 *   EmailRep        — email threat scoring
 *   Frankfurter     — live currency exchange rates (ECB data)
 */

import { Router } from 'express';
import * as enrichmentController from '../controllers/enrichment.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const router = Router();

router.use(authenticate);

// ─── Country & Timezone ───────────────────────────────────────────────────────
router.get('/country/:name', asyncWrapper(enrichmentController.getCountryInfo));
// The (*) wildcard allows slashes in timezone names like "America/New_York"
router.get('/time/:timezone(*)', asyncWrapper(enrichmentController.getWorldTime));

// ─── Public Holidays (Nager.Date) ─────────────────────────────────────────────
router.get('/holidays', asyncWrapper(enrichmentController.checkHoliday));                    // ?country=US&date=2026-03-15
router.get('/holidays/:country/:year', asyncWrapper(enrichmentController.getPublicHolidays)); // All holidays for a year

// ─── IP Geolocation (IPinfo) ──────────────────────────────────────────────────
router.get('/ip/:ip', asyncWrapper(enrichmentController.getIPInfo));

// ─── Email Enrichment ─────────────────────────────────────────────────────────
router.get('/email/validate',   asyncWrapper(enrichmentController.validateEmail));    // EVA + Disify
router.get('/email/reputation', asyncWrapper(enrichmentController.getEmailReputation)); // EmailRep
router.get('/email/breaches',   asyncWrapper(enrichmentController.checkEmailBreaches)); // HIBP (needs API key)

// ─── Currency Exchange (Frankfurter / ECB) ────────────────────────────────────
router.get('/currency/rate',  asyncWrapper(enrichmentController.getExchangeRate));   // ?from=USD&to=EUR
router.get('/currency/rates', asyncWrapper(enrichmentController.getExchangeRates));  // ?base=USD&targets=EUR,GBP

export default router;
