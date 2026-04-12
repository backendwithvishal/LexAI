/**
 * Groq Provider
 *
 * Implements the BaseProvider interface for Groq's inference API.
 * Groq is **OpenAI-compatible** (same request/response shape),
 * so we use the standard chat completions endpoint.
 *
 * Key Groq differences from OpenRouter:
 *   - Base URL: https://api.groq.com/openai/v1
 *   - No custom headers needed (no HTTP-Referer, X-Title)
 *   - Model IDs are simpler (e.g. 'llama-3.3-70b-versatile')
 *   - Supports response_format: { type: 'json_object' }
 *   - Extremely fast inference (LPU architecture)
 *
 * Rate limits (free tier):
 *   - 30 req/min, 14,400 req/day for most models
 *   - 6,000 tokens/min for large models
 */

import BaseProvider from './BaseProvider.js';
import logger from '../utils/logger.js';

export default class GroqProvider extends BaseProvider {
    constructor({ apiKey, baseUrl }) {
        super({
            name: 'groq',
            apiKey,
            baseUrl: baseUrl || 'https://api.groq.com/openai/v1',
        });
    }

    /**
     * Send a chat completion to Groq.
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

            logger.debug(`[GroqProvider] Calling ${options.model}`, {
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
                const error = new Error(`Groq API error: HTTP ${response.status}`);
                error.status = response.status;
                error.body = errorBody;
                throw error;
            }

            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content;

            if (!content) {
                throw new Error('Groq returned an empty response (no choices or content)');
            }

            const latencyMs = Date.now() - startTime;

            logger.debug(`[GroqProvider] Response received in ${latencyMs}ms`, {
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
                const timeoutErr = new Error(`Groq request timed out after ${timeoutMs}ms`);
                timeoutErr.status = 408;
                throw timeoutErr;
            }
            throw err;
        } finally {
            clearTimeout(timer);
        }
    }
}
