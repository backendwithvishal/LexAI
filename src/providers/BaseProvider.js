/**
 * BaseProvider — Abstract AI Provider
 *
 * Every AI provider (Groq, OpenRouter, OpenAI, Anthropic, etc.)
 * must extend this class and implement the abstract methods.
 *
 * This ensures a **unified interface** so the rest of the app
 * never cares which provider is active — it just calls
 * `provider.chatCompletion(messages, options)`.
 *
 * Standardized response shape:
 * {
 *   content: string,        // Raw text from the LLM
 *   tokensUsed: number,     // Total tokens consumed
 *   model: string,          // Model that actually ran
 *   latencyMs: number,      // Round-trip time
 *   provider: string,       // Provider name (e.g. 'groq')
 * }
 */

export default class BaseProvider {
    /**
     * @param {object} config
     * @param {string} config.name - Provider name (e.g. 'groq', 'openrouter')
     * @param {string} config.apiKey - API key for authentication
     * @param {string} config.baseUrl - Base URL for the API
     */
    constructor({ name, apiKey, baseUrl }) {
        if (new.target === BaseProvider) {
            throw new Error('BaseProvider is abstract — you must extend it.');
        }
        this._name = name;
        this._apiKey = apiKey;
        this._baseUrl = baseUrl;
    }

    /** Provider identifier (e.g. 'groq', 'openrouter'). */
    get name() {
        return this._name;
    }

    /** Whether this provider has a valid API key configured. */
    get isConfigured() {
        return Boolean(this._apiKey && this._apiKey.length > 0);
    }

    /**
     * Validate that the provider has all required configuration.
     * @throws {Error} If configuration is missing or invalid.
     */
    validateConfig() {
        if (!this._apiKey) {
            throw new Error(`[${this._name}] API key is not configured. Set the appropriate env var.`);
        }
        if (!this._baseUrl) {
            throw new Error(`[${this._name}] Base URL is not configured.`);
        }
    }

    /**
     * Send a chat completion request to the provider's API.
     *
     * @param {Array<{role: string, content: string}>} messages - Chat messages
     * @param {object} options
     * @param {string} options.model - Model identifier
     * @param {number} [options.temperature=0.2] - Sampling temperature
     * @param {number} [options.maxTokens=4096] - Max tokens in response
     * @param {object} [options.responseFormat] - e.g. { type: 'json_object' }
     * @param {number} [options.timeoutMs=60000] - Request timeout
     * @returns {Promise<{content: string, tokensUsed: number, model: string, latencyMs: number, provider: string}>}
     */
    // eslint-disable-next-line no-unused-vars
    async chatCompletion(messages, options = {}) {
        throw new Error(`[${this._name}] chatCompletion() is not implemented.`);
    }

    /**
     * Build the standard headers for this provider.
     * Subclasses can override to add provider-specific headers.
     *
     * @returns {object} HTTP headers
     */
    buildHeaders() {
        return {
            Authorization: `Bearer ${this._apiKey}`,
            'Content-Type': 'application/json',
        };
    }

    /**
     * Build the standard request body.
     * Subclasses can override for provider-specific payload shapes.
     *
     * @param {Array} messages
     * @param {object} options
     * @returns {object} Request body
     */
    buildRequestBody(messages, options) {
        const body = {
            model: options.model,
            messages,
            temperature: options.temperature ?? 0.2,
            max_tokens: options.maxTokens ?? 4096,
        };

        if (options.responseFormat) {
            body.response_format = options.responseFormat;
        }

        return body;
    }
}
