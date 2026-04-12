/**
 * AI Providers — Barrel Export
 *
 * Creates and exports the singleton AIGateway instance.
 * All registered providers are initialized here from env config.
 *
 * Usage:
 *   import { gateway } from '../providers/index.js';
 *   const result = await gateway.chatCompletion(messages, options);
 *
 * To add a new provider:
 *   1. Create the provider class extending BaseProvider
 *   2. Import it here
 *   3. Register it in the providers Map
 *   4. Add the name to the AI_PROVIDER enum in env.js
 */

import env from '../config/env.js';
import AIGateway from './AIGateway.js';
import GroqProvider from './GroqProvider.js';
import OpenRouterProvider from './OpenRouterProvider.js';

// ─── Initialize all providers ────────────────────────────────────
const providers = new Map();

providers.set('groq', new GroqProvider({
    apiKey: env.GROQ_API_KEY,
    baseUrl: env.GROQ_BASE_URL,
}));

providers.set('openrouter', new OpenRouterProvider({
    apiKey: env.OPENROUTER_API_KEY,
    baseUrl: env.OPENROUTER_BASE_URL,
}));

// ─── Create singleton gateway ────────────────────────────────────
export const gateway = new AIGateway({
    primaryProviderName: env.AI_PROVIDER,
    providers,
    defaultTimeoutMs: env.AI_REQUEST_TIMEOUT_MS,
});

export default gateway;
