/**
 * OpenRouter Provider
 *
 * Preserved as an optional fallback provider. OpenRouter proxies
 * to many models (OpenAI, Anthropic, Meta, Mistral, etc.) and
 * provides free-tier access to some models.
 *
 * OpenRouter-specific requirements:
 *   - HTTP-Referer header (for app attribution)
 *   - X-Title header (displayed in OpenRouter dashboard)
 *   - Model IDs include provider prefix (e.g. 'meta-llama/llama-3.1-8b-instruct:free')
 *
 * This provider is only activated when:
 *   1. AI_PROVIDER=openrouter, OR
 *   2. Groq fails and OPENROUTER_API_KEY is set (cross-provider fallback)
 */

import BaseProvider from './BaseProvider.js';
import logger from '../utils/logger.js';

export default class OpenRouterProvider extends BaseProvider {
    constructor({ apiKey, baseUrl }) {
        super({
            name: 'openrouter',
            apiKey,
            baseUrl: baseUrl || 'https://openrouter.ai/api/v1',
        });
    }

    /**
     * Override headers to include OpenRouter-specific attribution headers.
     */
    buildHeaders() {
        return {
            ...super.buildHeaders(),
            'HTTP-Referer': 'https://lexai.io',
            'X-Title': 'LexAI Contract Analysis',
        };
    }

    /**
     * Send a chat completion to OpenRouter.
     *
     * @param {Array<{role: string, content: string}>} messages
     * @param {object} options
     * @returns {Promise<{content: string, tokensUsed: number, model: string, latencyMs: number, provider: string}>}
     */
    async chatCompletion(messages, options = {}) {
        this.validateConfig();

        const startTime = Date.now();
        const timeoutMs = options.timeoutMs || 60000;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const url = `${this._baseUrl}/chat/completions`;
            const body = this.buildRequestBody(messages, options);

            logger.debug(`[OpenRouterProvider] Calling ${options.model}`, {
                messageCount: messages.length,
                maxTokens: body.max_tokens,
            });

            const response = await fetch(url, {
                method: 'POST',
                headers: this.buildHeaders(),
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorBody = await response.text().catch(() => 'No error body');
                const error = new Error(`OpenRouter API error: HTTP ${response.status}`);
                error.status = response.status;
                error.body = errorBody;
                throw error;
            }

            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content;

            if (!content) {
                throw new Error('OpenRouter returned an empty response (no choices or content)');
            }

            const latencyMs = Date.now() - startTime;

            logger.debug(`[OpenRouterProvider] Response received in ${latencyMs}ms`, {
                model: data.model,
                tokensUsed: data?.usage?.total_tokens || 0,
            });

            return {
                content,
                tokensUsed: data?.usage?.total_tokens || 0,
                promptTokens: data?.usage?.prompt_tokens || 0,
                completionTokens: data?.usage?.completion_tokens || 0,
                model: data.model || options.model,
                latencyMs,
                provider: this._name,
            };
        } catch (err) {
            if (err.name === 'AbortError') {
                const timeoutErr = new Error(`OpenRouter request timed out after ${timeoutMs}ms`);
                timeoutErr.status = 408;
                throw timeoutErr;
            }
            throw err;
        } finally {
            clearTimeout(timer);
        }
    }
}
