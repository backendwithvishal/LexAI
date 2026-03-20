/**
 * Enrichment Controller
 *
 * Exposes enrichment data from public APIs:
 *   - Country info for jurisdiction enrichment
 *   - World time for timezone-aware expiry calculations
 *   - Public holidays (Nager.Date — no key, 90+ countries)
 *   - IP geolocation (IPinfo — no key for basic usage)
 *   - Email validation (EVA — no key)
 *   - Disposable email detection (Disify — no key)
 *   - Email breach check (HaveIBeenPwned — requires HIBP_API_KEY)
 *   - Email reputation (EmailRep — no key)
 *   - Currency exchange rates (Frankfurter — no key)
 *
 * All endpoints are non-critical — they return null/empty on failure
 * so the frontend can gracefully degrade.
 */

import * as enrichmentService from '../services/enrichment.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import HTTP from '../constants/httpStatus.js';

// ─── Country Info ─────────────────────────────────────────────────────────────

/**
 * GET /enrichment/country/:name
 * Get country information for jurisdiction enrichment.
 */
export async function getCountryInfo(req, res) {
    const { name } = req.params;

    if (!name || name.trim().length < 2) {
        return res.status(HTTP.BAD_REQUEST).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Country name must be at least 2 characters.' },
        });
    }

    const data = await enrichmentService.getCountryInfo(name);

    if (!data) {
        return res.status(HTTP.NOT_FOUND).json({
            success: false,
            error: { code: 'NOT_FOUND', message: `Could not find country: ${name}` },
        });
    }

    sendSuccess(res, { country: data });
}

// ─── World Time ───────────────────────────────────────────────────────────────

/**
 * GET /enrichment/time/:timezone
 * Get current time for a timezone.
 */
export async function getWorldTime(req, res) {
    const { timezone } = req.params;

    const data = await enrichmentService.getWorldTime(timezone);

    if (!data) {
        return res.status(HTTP.NOT_FOUND).json({
            success: false,
            error: { code: 'NOT_FOUND', message: `Could not fetch time for timezone: ${timezone}` },
        });
    }

    sendSuccess(res, { time: data });
}

// ─── Public Holidays ──────────────────────────────────────────────────────────

/**
 * GET /enrichment/holidays?country=US&date=2026-03-15
 * Check if a specific date falls on a public holiday.
 */
export async function checkHoliday(req, res) {
    const { country, date } = req.query;

    if (!country || !date) {
        return res.status(HTTP.BAD_REQUEST).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Both country (2-letter code) and date (YYYY-MM-DD) are required.' },
        });
    }

    if (!/^[A-Za-z]{2}$/.test(country)) {
        return res.status(HTTP.BAD_REQUEST).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Country must be a 2-letter ISO code (e.g., US, GB).' },
        });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
        return res.status(HTTP.BAD_REQUEST).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid date format. Use YYYY-MM-DD.' },
        });
    }

    const data = await enrichmentService.checkHoliday(country, parsedDate);

    if (!data) {
        return sendSuccess(res, { holiday: { isHoliday: false, holidays: [], note: 'Holiday API unavailable' } });
    }

    sendSuccess(res, { holiday: data });
}

/**
 * GET /enrichment/holidays/:country/:year
 * Get all public holidays for a country in a given year.
 */
export async function getPublicHolidays(req, res) {
    const { country, year } = req.params;

    if (!/^[A-Za-z]{2}$/.test(country)) {
        return res.status(HTTP.BAD_REQUEST).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Country must be a 2-letter ISO code (e.g., US, GB).' },
        });
    }

    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
        return res.status(HTTP.BAD_REQUEST).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Year must be a valid number between 2000 and 2100.' },
        });
    }

    const data = await enrichmentService.getPublicHolidays(country, yearNum);

    if (!data) {
        return res.status(HTTP.NOT_FOUND).json({
            success: false,
            error: { code: 'NOT_FOUND', message: `No holiday data found for ${country}/${year}.` },
        });
    }

    sendSuccess(res, { holidays: data, country: country.toUpperCase(), year: yearNum });
}

// ─── IP Geolocation ───────────────────────────────────────────────────────────

/**
 * GET /enrichment/ip/:ip
 * Get geolocation data for an IP address.
 * Useful for flagging logins from unexpected locations.
 */
export async function getIPInfo(req, res) {
    const { ip } = req.params;

    // Basic IP format validation (IPv4 or IPv6)
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^[0-9a-fA-F:]+$/;
    if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
        return res.status(HTTP.BAD_REQUEST).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid IP address format.' },
        });
    }

    const data = await enrichmentService.getIPInfo(ip);

    if (!data) {
        return res.status(HTTP.NOT_FOUND).json({
            success: false,
            error: { code: 'NOT_FOUND', message: `Could not retrieve info for IP: ${ip}` },
        });
    }

    sendSuccess(res, { ipInfo: data });
}

// ─── Email Validation ─────────────────────────────────────────────────────────

/**
 * GET /enrichment/email/validate?email=user@example.com
 * Validate an email address (syntax + MX record check).
 */
export async function validateEmail(req, res) {
    const { email } = req.query;

    if (!email || !email.includes('@')) {
        return res.status(HTTP.BAD_REQUEST).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'A valid email address is required.' },
        });
    }

    const [validation, disposable] = await Promise.all([
        enrichmentService.validateEmail(email),
        enrichmentService.checkDisposableEmail(email),
    ]);

    sendSuccess(res, {
        email,
        validation: validation || { note: 'Validation service unavailable' },
        disposable: disposable || { note: 'Disposable check unavailable' },
    });
}

/**
 * GET /enrichment/email/reputation?email=user@example.com
 * Get threat/risk reputation for an email address.
 */
export async function getEmailReputation(req, res) {
    const { email } = req.query;

    if (!email || !email.includes('@')) {
        return res.status(HTTP.BAD_REQUEST).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'A valid email address is required.' },
        });
    }

    const data = await enrichmentService.getEmailReputation(email);

    if (!data) {
        return sendSuccess(res, { email, reputation: { note: 'Reputation service unavailable' } });
    }

    sendSuccess(res, { email, reputation: data });
}

/**
 * GET /enrichment/email/breaches?email=user@example.com
 * Check if an email has appeared in known data breaches (HIBP).
 * Requires HIBP_API_KEY to be configured.
 */
export async function checkEmailBreaches(req, res) {
    const { email } = req.query;

    if (!email || !email.includes('@')) {
        return res.status(HTTP.BAD_REQUEST).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'A valid email address is required.' },
        });
    }

    const data = await enrichmentService.checkEmailBreaches(email);

    if (!data) {
        return sendSuccess(res, { email, breaches: { note: 'Breach check unavailable — HIBP_API_KEY may not be configured.' } });
    }

    sendSuccess(res, { email, breaches: data });
}

// ─── Currency Exchange ────────────────────────────────────────────────────────

/**
 * GET /enrichment/currency/rate?from=USD&to=EUR
 * Get the latest exchange rate between two currencies.
 */
export async function getExchangeRate(req, res) {
    const { from, to } = req.query;

    if (!from || !to) {
        return res.status(HTTP.BAD_REQUEST).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Both "from" and "to" currency codes are required (e.g., USD, EUR).' },
        });
    }

    if (!/^[A-Za-z]{3}$/.test(from) || !/^[A-Za-z]{3}$/.test(to)) {
        return res.status(HTTP.BAD_REQUEST).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Currency codes must be 3-letter ISO codes (e.g., USD, EUR, GBP).' },
        });
    }

    const data = await enrichmentService.getExchangeRate(from, to);

    if (!data) {
        return res.status(HTTP.NOT_FOUND).json({
            success: false,
            error: { code: 'NOT_FOUND', message: `Could not fetch exchange rate for ${from.toUpperCase()} → ${to.toUpperCase()}.` },
        });
    }

    sendSuccess(res, { exchange: data });
}

/**
 * GET /enrichment/currency/rates?base=USD&targets=EUR,GBP,JPY
 * Get exchange rates from a base currency to multiple targets.
 */
export async function getExchangeRates(req, res) {
    const { base, targets } = req.query;

    if (!base) {
        return res.status(HTTP.BAD_REQUEST).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Base currency code is required (e.g., USD).' },
        });
    }

    if (!/^[A-Za-z]{3}$/.test(base)) {
        return res.status(HTTP.BAD_REQUEST).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Base currency must be a 3-letter ISO code (e.g., USD).' },
        });
    }

    const targetList = targets
        ? targets.split(',').map((t) => t.trim()).filter((t) => /^[A-Za-z]{3}$/.test(t))
        : [];

    const data = await enrichmentService.getExchangeRates(base, targetList);

    if (!data) {
        return res.status(HTTP.NOT_FOUND).json({
            success: false,
            error: { code: 'NOT_FOUND', message: `Could not fetch exchange rates for base currency: ${base.toUpperCase()}.` },
        });
    }

    sendSuccess(res, { exchange: data });
}
