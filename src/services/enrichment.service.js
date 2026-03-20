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

import axios from 'axios';
import logger from '../utils/logger.js';

const TIMEOUT = 5000; // 5s timeout — fail fast for external API calls

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
        const response = await axios.get(`${baseUrl}/name/${encodeURIComponent(countryName)}`, {
            timeout: TIMEOUT,
            params: { fields: 'name,region,subregion,currencies,timezones,capital,cca2' },
        });

        const country = response.data?.[0];
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
        const response = await axios.get(`${baseUrl}/timezone/${timezone}`, { timeout: TIMEOUT });
        return {
            datetime: response.data?.datetime,
            timezone: response.data?.timezone,
            utcOffset: response.data?.utc_offset,
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
        const response = await axios.get('https://api.ipify.org', {
            params: { format: 'json' },
            timeout: TIMEOUT,
        });
        return response.data?.ip || null;
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
        if (!ip || ip === '127.0.0.1' || ip === '::1') return null; // skip localhost

        const token = process.env.IPINFO_TOKEN; // optional — increases rate limit
        const params = token ? { token } : {};

        const response = await axios.get(`https://ipinfo.io/${ip}/json`, {
            params,
            timeout: TIMEOUT,
        });

        const data = response.data;
        if (!data || data.bogon) return null; // bogon = private/reserved IP

        return {
            ip: data.ip,
            city: data.city || '',
            region: data.region || '',
            country: data.country || '',
            org: data.org || '',       // ISP / ASN info
            timezone: data.timezone || '',
            loc: data.loc || '',       // "lat,lon" string
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

        const response = await axios.get(
            `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode.toUpperCase()}`,
            { timeout: TIMEOUT }
        );

        const holidays = response.data;
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
        const response = await axios.get(
            `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode.toUpperCase()}`,
            { timeout: TIMEOUT }
        );
        return Array.isArray(response.data) ? response.data : null;
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
        const response = await axios.get('https://api.eva.pingutil.com/email', {
            params: { email },
            timeout: TIMEOUT,
        });

        const data = response.data?.data;
        if (!data) return null;

        return {
            valid: data.valid_syntax && data.deliverable,
            validSyntax: data.valid_syntax,
            deliverable: data.deliverable,
            disposable: data.disposable,
            catchAll: data.catch_all,
            domain: data.domain,
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
        const response = await axios.get('https://www.disify.com/api/email', {
            params: { email },
            timeout: TIMEOUT,
        });

        const data = response.data;
        if (!data) return null;

        return {
            disposable: data.disposable === true,
            format: data.format,       // true if email format is valid
            dns: data.dns,             // true if domain has valid DNS
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

        const response = await axios.get(
            `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`,
            {
                headers: {
                    'hibp-api-key': apiKey,
                    'User-Agent': 'LexAI-Contract-Platform',
                },
                params: { truncateResponse: true },
                timeout: TIMEOUT,
            }
        );

        const breaches = response.data;
        if (!Array.isArray(breaches)) return { breached: false, breachCount: 0, breaches: [] };

        return {
            breached: breaches.length > 0,
            breachCount: breaches.length,
            breaches: breaches.map((b) => b.Name),
        };
    } catch (err) {
        // 404 = email not found in any breach (this is the happy path)
        if (err.response?.status === 404) {
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
        const response = await axios.get(`https://emailrep.io/${encodeURIComponent(email)}`, {
            headers: { 'User-Agent': 'LexAI-Contract-Platform' },
            timeout: TIMEOUT,
        });

        const data = response.data;
        if (!data) return null;

        return {
            reputation: data.reputation,       // "high", "medium", "low", "none"
            suspicious: data.suspicious,
            references: data.references,       // number of sources that have seen this email
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
        const response = await axios.get('https://api.frankfurter.app/latest', {
            params: { from: from.toUpperCase(), to: to.toUpperCase() },
            timeout: TIMEOUT,
        });

        const data = response.data;
        const rate = data?.rates?.[to.toUpperCase()];
        if (!rate) return null;

        return {
            from: data.base,
            to: to.toUpperCase(),
            rate,
            date: data.date,
        };
    } catch (err) {
        logger.warn(`Frankfurter exchange rate failed (${from}→${to}): ${err.message}`);
        return null;
    }
}

/**
 * Get exchange rates from a base currency to multiple targets.
 *
 * @param {string} base - Base currency code (e.g., "USD")
 * @param {string[]} targets - Array of target currency codes (e.g., ["EUR", "GBP", "JPY"])
 * @returns {Promise<object|null>} { base, date, rates: { EUR: 0.92, ... } } or null
 */
export async function getExchangeRates(base, targets = []) {
    try {
        const params = { from: base.toUpperCase() };
        if (targets.length > 0) {
            params.to = targets.map((t) => t.toUpperCase()).join(',');
        }

        const response = await axios.get('https://api.frankfurter.app/latest', {
            params,
            timeout: TIMEOUT,
        });

        const data = response.data;
        if (!data?.rates) return null;

        return {
            base: data.base,
            date: data.date,
            rates: data.rates,
        };
    } catch (err) {
        logger.warn(`Frankfurter exchange rates failed for base "${base}": ${err.message}`);
        return null;
    }
}
