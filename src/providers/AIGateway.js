/**
 * AI Gateway — Central Provider Orchestrator
 *
 * This is the single entry point for ALL AI calls in the application.
 * No service should ever call a provider directly — everything goes
 * through the gateway.
 *
 * Responsibilities:
 *   1. Provider selection based on AI_PROVIDER env var
 *   2. Retry with exponential backoff on transient errors (429, 5xx)
 *   3. Cross-provider fallback: if primary provider exhausts retries,
 *      automatically try the secondary provider (if configured)
 *   4. Request/response logging
 *   5. Unified error enrichment
 *
 * Adding a new provider:
 *   1. Create src/providers/NewProvider.js extending BaseProvider
 *   2. Register it in this gateway's constructor
 *   3. Add the new option to AI_PROVIDER enum in env.js
 *   4. Done — no other code changes needed
 */

import logger from '../utils/logger.js';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000; // 2s → 4s → 8s

/** HTTP status codes that trigger a retry. */
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export default class AIGateway {
    /**
     * @param {object} config
     * @param {string} config.primaryProviderName - Name of the primary provider
     * @param {Map<string, import('./BaseProvider.js').default>} config.providers - All registered providers
     * @param {number} [config.defaultTimeoutMs=60000] - Default request timeout
     */
    constructor({ primaryProviderName, providers, defaultTimeoutMs = 60000 }) {
        this._providers = providers;
        this._primaryProviderName = primaryProviderName;
        this._defaultTimeoutMs = defaultTimeoutMs;

        // Validate primary provider exists
        if (!this._providers.has(primaryProviderName)) {
            const available = [...this._providers.keys()].join(', ');
            throw new Error(
                `AI_PROVIDER="${primaryProviderName}" is not registered. Available: ${available}`
            );
        }

        logger.info(`[AIGateway] Initialized with primary provider: ${primaryProviderName}`);
        for (const [name, provider] of this._providers) {
            logger.info(`[AIGateway]   → ${name}: ${provider.isConfigured ? '✅ configured' : '⚠️  no API key'}`);
        }
    }

    /** Get the active primary provider name. */
    get activeProvider() {
        return this._primaryProviderName;
    }

    /** Get a list of all registered provider names. */
    get registeredProviders() {
        return [...this._providers.keys()];
    }

    /** Get provider health status for diagnostics. */
    getProviderStatus() {
        const status = {};
        for (const [name, provider] of this._providers) {
            status[name] = {
                configured: provider.isConfigured,
                isPrimary: name === this._primaryProviderName,
            };
        }
        return status;
    }

    /**
     * Send a chat completion request through the gateway.
     *
     * Tries the primary provider first with retries. If all retries
     * are exhausted, falls through to any other configured provider.
     *
     * @param {Array<{role: string, content: string}>} messages
     * @param {object} options
     * @param {string} options.model - Model identifier
     * @param {number} [options.temperature=0.2]
     * @param {number} [options.maxTokens=4096]
     * @param {object} [options.responseFormat]
     * @param {number} [options.timeoutMs]
     * @returns {Promise<{content: string, tokensUsed: number, model: string, latencyMs: number, provider: string}>}
     */
    async chatCompletion(messages, options = {}) {
        const opts = {
            ...options,
            timeoutMs: options.timeoutMs || this._defaultTimeoutMs,
        };

        // 1. Try primary provider with retries
        const primaryProvider = this._providers.get(this._primaryProviderName);
        if (primaryProvider.isConfigured) {
            try {
                return await this._callWithRetry(primaryProvider, messages, opts);
            } catch (err) {
                logger.warn(
                    `[AIGateway] Primary provider "${this._primaryProviderName}" failed after all retries: ${err.message}`
                );
            }
        } else {
            logger.warn(`[AIGateway] Primary provider "${this._primaryProviderName}" has no API key — skipping`);
        }

        // 2. Cross-provider fallback — try every other configured provider
        for (const [name, provider] of this._providers) {
            if (name === this._primaryProviderName) continue;
            if (!provider.isConfigured) continue;

            logger.info(`[AIGateway] Falling back to provider: ${name}`);
            try {
                return await this._callWithRetry(provider, messages, opts);
            } catch (err) {
                logger.warn(`[AIGateway] Fallback provider "${name}" also failed: ${err.message}`);
            }
        }

        // 3. All providers failed
        throw new Error(
            'All AI providers failed. Check API keys and provider availability.'
        );
    }

    /**
     * Call a provider with exponential backoff retry on transient errors.
     *
     * @param {import('./BaseProvider.js').default} provider
     * @param {Array} messages
     * @param {object} options
     * @returns {Promise<object>}
     */
    async _callWithRetry(provider, messages, options, attempt = 1) {
        try {
            return await provider.chatCompletion(messages, options);
        } catch (err) {
            const status = err.status || 0;
            const isRetryable = RETRYABLE_STATUS_CODES.has(status);

            if (isRetryable && attempt < MAX_RETRIES) {
                const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                logger.warn(
                    `[AIGateway] ${provider.name} returned ${status}. ` +
                    `Retry ${attempt}/${MAX_RETRIES} in ${delay}ms`
                );
                await this._sleep(delay);
                return this._callWithRetry(provider, messages, options, attempt + 1);
            }

            // Non-retryable or exhausted retries — enrich error and throw
            err.message = `[${provider.name}] ${err.message} (attempt ${attempt}/${MAX_RETRIES})`;
            throw err;
        }
    }

    /**
     * Promise-based sleep for retry backoff.
     * @param {number} ms
     */
    _sleep(ms) {
        return new Promise((resolve) => { setTimeout(resolve, ms); });
    }
}
