/**
 * Enrichment Service
 *
 * Fetches data from public external APIs to enrich contract analysis and
 * improve security/validation across the platform:
 *
 *   - REST Countries     : country/jurisdiction validation, timezone, currency
 *   - World Time API     : accurate current time for expiry calculations
 *   - IPify              : user's public IP for audit logging
 *   - IPinfo             : IP geolocation for login security (no key required)
 *   - Nager.Date         : public holidays for 90+ countries (no key required)
 *   - EVA                : free email syntax + MX validation (no key required)
 *   - Disify             : detect disposable/temporary email addresses (no key)
 *   - HaveIBeenPwned     : check if email appears in known data breaches (apiKey)
 *   - EmailRep           : email threat/risk scoring (no key required)
 *   - Frankfurter        : live currency exchange rates (no key required)
 *
 * All calls use HTTPS with a 5s timeout. Failures are NON-FATAL —
 * enrichment is optional, the app works fine without it.
 * Every function returns null on failure instead of throwing.
 */

import logger from '../utils/logger.js';

const TIMEOUT = 5000; // 5s timeout — fail fast for external API calls

/**
 * Thin fetch wrapper with timeout support.
 * Returns parsed JSON or throws on non-2xx / timeout.
 */
async function fetchJSON(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        clearTimeout(timer);
        throw err;
    }
}

// ─── REST Countries ───────────────────────────────────────────────────────────

/**
 * Get country information for jurisdiction enrichment.
 * Used to enrich contracts with region, timezone, and currency data.
 *
 * @param {string} countryName - e.g., "United States"
 * @returns {Promise<object|null>}
 */
export async function getCountryInfo(countryName) {
    try {
        const baseUrl = process.env.REST_COUNTRIES_URL || 'https://restcountries.com/v3.1';
        const params = new URLSearchParams({ fields: 'name,region,subregion,currencies,timezones,capital,cca2' });
        const data = await fetchJSON(`${baseUrl}/name/${encodeURIComponent(countryName)}?${params}`);

        const country = data?.[0];
        if (!country) return null;

        const currencies = country.currencies ? Object.keys(country.currencies) : [];
        return {
            name: country.name?.common || countryName,
            countryCode: country.cca2 || '',
            region: country.region,
            subregion: country.subregion,
            currency: currencies[0] || 'USD',
            timezones: country.timezones || [],
            capital: country.capital?.[0] || '',
        };
    } catch (err) {
        logger.warn(`REST Countries API failed for "${countryName}": ${err.message}`);
        return null;
    }
}

// ─── World Time API ───────────────────────────────────────────────────────────

/**
 * Get the current time for a timezone (used for accurate expiry calculations).
 *
 * @param {string} timezone - e.g., "America/New_York"
 * @returns {Promise<object|null>}
 */
export async function getWorldTime(timezone) {
    try {
        const baseUrl = process.env.WORLD_TIME_API_URL || 'https://worldtimeapi.org/api';
        const data = await fetchJSON(`${baseUrl}/timezone/${timezone}`);
        return {
            datetime: data?.datetime,
            timezone: data?.timezone,
            utcOffset: data?.utc_offset,
        };
    } catch (err) {
        logger.warn(`World Time API failed for "${timezone}": ${err.message}`);
        return null;
    }
}

// ─── IPify ────────────────────────────────────────────────────────────────────

/**
 * Get the server's public IP address (for audit logging).
 *
 * @returns {Promise<string|null>}
 */
export async function getPublicIP() {
    try {
        const data = await fetchJSON('https://api.ipify.org?format=json');
        return data?.ip || null;
    } catch (err) {
        logger.warn('IPify API failed:', err.message);
        return null;
    }
}

// ─── IPinfo ───────────────────────────────────────────────────────────────────

/**
 * Get geolocation data for an IP address.
 * Used for login security — flag logins from unexpected countries/regions.
 * No API key required for basic usage (up to 50k requests/month).
 *
 * @param {string} ip - IPv4 or IPv6 address
 * @returns {Promise<object|null>} Location data or null on failure
 */
export async function getIPInfo(ip) {
    try {
        if (!ip || ip === '127.0.0.1' || ip === '::1') return null;

        const token = process.env.IPINFO_TOKEN;
        const url = token
            ? `https://ipinfo.io/${ip}/json?token=${token}`
            : `https://ipinfo.io/${ip}/json`;

        const data = await fetchJSON(url);
        if (!data || data.bogon) return null;

        return {
            ip: data.ip,
            city: data.city || '',
            region: data.region || '',
            country: data.country || '',
            org: data.org || '',
            timezone: data.timezone || '',
            loc: data.loc || '',
        };
    } catch (err) {
        logger.warn(`IPinfo API failed for "${ip}": ${err.message}`);
        return null;
    }
}

// ─── Nager.Date (Public Holidays) ────────────────────────────────────────────

/**
 * Check if a date falls on a public holiday in a given country.
 * Uses Nager.Date — free, no API key, supports 90+ countries.
 * Useful for warning users if a contract expires on a holiday.
 *
 * @param {string} countryCode - ISO 3166-1 alpha-2 code (e.g., "US", "GB")
 * @param {Date} date - The date to check
 * @returns {Promise<object|null>} Holiday info or null if unavailable
 */
export async function checkHoliday(countryCode, date) {
    try {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const holidays = await fetchJSON(
            `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode.toUpperCase()}`
        );
        if (!Array.isArray(holidays)) return { isHoliday: false, holidays: [] };

        const matching = holidays.filter((h) => h.date === dateStr);
        return {
            isHoliday: matching.length > 0,
            holidays: matching.map((h) => ({ name: h.name, localName: h.localName, type: h.types?.[0] || 'Public' })),
        };
    } catch (err) {
        logger.warn(`Nager.Date holiday check failed for "${countryCode}": ${err.message}`);
        return null;
    }
}

/**
 * Get all public holidays for a country in a given year.
 * Useful for displaying a calendar of holidays in the contract UI.
 *
 * @param {string} countryCode - ISO 3166-1 alpha-2 code (e.g., "US")
 * @param {number} year - e.g., 2026
 * @returns {Promise<Array|null>}
 */
export async function getPublicHolidays(countryCode, year) {
    try {
        const data = await fetchJSON(
            `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode.toUpperCase()}`
        );
        return Array.isArray(data) ? data : null;
    } catch (err) {
        logger.warn(`Nager.Date getPublicHolidays failed for "${countryCode}/${year}": ${err.message}`);
        return null;
    }
}

// ─── EVA Email Validation ─────────────────────────────────────────────────────

/**
 * Validate an email address using EVA (pingutil.com).
 * Checks syntax, MX records, and whether the domain accepts mail.
 * No API key required.
 *
 * @param {string} email
 * @returns {Promise<object|null>} Validation result or null on failure
 */
export async function validateEmail(email) {
    try {
        const data = await fetchJSON(`https://api.eva.pingutil.com/email?email=${encodeURIComponent(email)}`);
        const d = data?.data;
        if (!d) return null;
        return {
            valid: d.valid_syntax && d.deliverable,
            validSyntax: d.valid_syntax,
            deliverable: d.deliverable,
            disposable: d.disposable,
            catchAll: d.catch_all,
            domain: d.domain,
        };
    } catch (err) {
        logger.warn(`EVA email validation failed for "${email}": ${err.message}`);
        return null;
    }
}

// ─── Disify Disposable Email Detection ───────────────────────────────────────

/**
 * Check if an email address is from a disposable/temporary email provider.
 * Prevents throwaway accounts from registering. No API key required.
 *
 * @param {string} email
 * @returns {Promise<object|null>} { disposable: boolean, domain: string } or null
 */
export async function checkDisposableEmail(email) {
    try {
        const data = await fetchJSON(`https://www.disify.com/api/email?email=${encodeURIComponent(email)}`);
        if (!data) return null;
        return {
            disposable: data.disposable === true,
            format: data.format,
            dns: data.dns,
            domain: data.domain || '',
        };
    } catch (err) {
        logger.warn(`Disify disposable check failed for "${email}": ${err.message}`);
        return null;
    }
}

// ─── HaveIBeenPwned ───────────────────────────────────────────────────────────

/**
 * Check if an email address has appeared in known data breaches.
 * Requires a HIBP API key (free tier available at haveibeenpwned.com).
 * Used during registration to warn users about compromised credentials.
 *
 * @param {string} email
 * @returns {Promise<object|null>} { breached: boolean, breachCount: number, breaches: string[] } or null
 */
export async function checkEmailBreaches(email) {
    try {
        const apiKey = process.env.HIBP_API_KEY;
        if (!apiKey) {
            logger.debug('HIBP_API_KEY not configured — skipping breach check');
            return null;
        }

        const data = await fetchJSON(
            `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=true`,
            {
                headers: {
                    'hibp-api-key': apiKey,
                    'User-Agent': 'LexAI-Contract-Platform',
                },
            }
        );

        const breaches = Array.isArray(data) ? data : [];
        return {
            breached: breaches.length > 0,
            breachCount: breaches.length,
            breaches: breaches.map((b) => b.Name),
        };
    } catch (err) {
        if (err.message.includes('404')) {
            return { breached: false, breachCount: 0, breaches: [] };
        }
        logger.warn(`HIBP breach check failed for email: ${err.message}`);
        return null;
    }
}

// ─── EmailRep ─────────────────────────────────────────────────────────────────

/**
 * Get threat/risk scoring for an email address.
 * Returns reputation data: spam score, suspicious flag, malicious activity.
 * No API key required for basic usage.
 *
 * @param {string} email
 * @returns {Promise<object|null>}
 */
export async function getEmailReputation(email) {
    try {
        const data = await fetchJSON(`https://emailrep.io/${encodeURIComponent(email)}`, {
            headers: { 'User-Agent': 'LexAI-Contract-Platform' },
        });
        if (!data) return null;
        return {
            reputation: data.reputation,
            suspicious: data.suspicious,
            references: data.references,
            details: {
                maliciousActivity: data.details?.malicious_activity,
                spamActivity: data.details?.spam,
                freeProvider: data.details?.free_provider,
                disposable: data.details?.disposable,
                deliverable: data.details?.deliverable,
            },
        };
    } catch (err) {
        logger.warn(`EmailRep check failed for email: ${err.message}`);
        return null;
    }
}

// ─── Frankfurter Currency Exchange ───────────────────────────────────────────

/**
 * Get the latest exchange rate between two currencies.
 * Useful for contracts with financial terms in different currencies.
 * No API key required — powered by the European Central Bank data.
 *
 * @param {string} from - Base currency code (e.g., "USD")
 * @param {string} to   - Target currency code (e.g., "EUR")
 * @returns {Promise<object|null>} { from, to, rate, date } or null
 */
export async function getExchangeRate(from, to) {
    try {
        const data = await fetchJSON(
            `https://api.frankfurter.app/latest?from=${from.toUpperCase()}&to=${to.toUpperCase()}`
        );
        const rate = data?.rates?.[to.toUpperCase()];
        if (!rate) return null;
        return { from: data.base, to: to.toUpperCase(), rate, date: data.date };
    } catch (err) {
        logger.warn(`Frankfurter exchange rate failed (${from}→${to}): ${err.message}`);
        return null;
    }
}

export async function getExchangeRates(base, targets = []) {
    try {
        const params = new URLSearchParams({ from: base.toUpperCase() });
        if (targets.length > 0) params.set('to', targets.map((t) => t.toUpperCase()).join(','));

        const data = await fetchJSON(`https://api.frankfurter.app/latest?${params}`);
        if (!data?.rates) return null;
        return { base: data.base, date: data.date, rates: data.rates };
    } catch (err) {
        logger.warn(`Frankfurter exchange rates failed for base "${base}": ${err.message}`);
        return null;
    }
}
