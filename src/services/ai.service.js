/**
 * AI Service
 *
 * Central business-logic layer for all AI-powered features.
 * Routes all LLM calls through the AIGateway (provider-agnostic).
 *
 * Implements:
 *   - Contract analysis with primary → fallback model chain
 *   - Contract diff explanation
 *   - Clause summarization
 *   - Contract Q&A (ask questions about a contract)
 *   - Key terms extraction
 *   - Risk explanation
 *   - Contract translation
 *   - Compliance check
 *
 * The AI output is always validated and sanitized — missing fields get
 * safe defaults so the rest of the app never crashes on bad AI output.
 */

import env from '../config/env.js';
import { gateway } from '../providers/index.js';
import logger from '../utils/logger.js';

// ─────────────────────────────────────────────────────────────────
//  1. CONTRACT ANALYSIS (existing — migrated to gateway)
// ─────────────────────────────────────────────────────────────────

/**
 * Analyze a contract using the AI gateway.
 * Tries the primary model first; falls back to a secondary model on failure.
 *
 * @param {string} content - Full contract text
 * @returns {Promise<object>} Structured analysis result
 */
export async function analyzeContract(content) {
    const primaryModel = env.AI_PRIMARY_MODEL;
    const fallbackModel = env.AI_FALLBACK_MODEL;

    // Try primary model first
    try {
        const result = await callAI(content, primaryModel);
        return { ...result, aiModel: primaryModel };
    } catch (err) {
        logger.warn(`Primary model failed (${primaryModel}): ${err.message}. Trying fallback...`);
    }

    // If primary fails, try fallback model
    try {
        const result = await callAI(content, fallbackModel);
        return { ...result, aiModel: fallbackModel };
    } catch (err) {
        logger.error(`Fallback model also failed (${fallbackModel}): ${err.message}`);
        throw new Error(`AI analysis failed with both models. Last error: ${err.message}`);
    }
}

/**
 * Call the AI gateway for contract analysis.
 * The gateway handles provider selection, retries, and cross-provider fallback.
 */
async function callAI(content, model) {
    const startTime = Date.now();

    const messages = [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(content) },
    ];

    const response = await gateway.chatCompletion(messages, {
        model,
        temperature: 0.2,
        maxTokens: 4096,
        responseFormat: { type: 'json_object' },
    });

    const parsed = parseAIResponse(response.content);
    parsed.tokensUsed = response.tokensUsed || 0;
    parsed.processingTimeMs = Date.now() - startTime;
    parsed.provider = response.provider;

    return parsed;
}

// ─────────────────────────────────────────────────────────────────
//  2. DIFF EXPLANATION (existing — migrated to gateway)
// ─────────────────────────────────────────────────────────────────

/**
 * Generate an AI explanation for a contract version diff.
 *
 * @param {string} diffText - Unified diff text
 * @param {string} contractTitle - Title of the contract
 * @returns {Promise<object>} Structured diff analysis
 */
export async function explainDiff(diffText, contractTitle) {
    const diffModel = env.AI_DIFF_MODEL;

    const prompt = `You are a legal contract analyst. Below is a diff between two versions of the contract titled "${contractTitle}". Analyze the changes and return a JSON object:

{
  "summary": "A paragraph explaining what changed between the two versions",
  "changesAnalysis": [
    {
      "change": "Description of the change",
      "impact": "Whether this change favors or hurts the signing party",
      "severity": "<positive|neutral|negative>"
    }
  ],
  "newRisks": ["Any newly introduced risky clauses"],
  "recommendation": "Overall recommendation about this version update"
}

Diff:
${diffText}`;

    const messages = [
        { role: 'system', content: 'You are a legal contract analyst. Return only valid JSON. Label all output as AI analysis, not legal advice.' },
        { role: 'user', content: prompt },
    ];

    try {
        const response = await gateway.chatCompletion(messages, {
            model: diffModel,
            temperature: 0.2,
            maxTokens: 2048,
        });

        return parseAIResponse(response.content);
    } catch (err) {
        logger.error('Diff AI explanation failed:', err.message);
        throw new Error(`AI diff explanation failed: ${err.message}`);
    }
}

// ─────────────────────────────────────────────────────────────────
//  3. CLAUSE SUMMARIZATION (NEW)
// ─────────────────────────────────────────────────────────────────

/**
 * Summarize a specific clause in plain English.
 * Useful for in-context help — user clicks a clause and gets
 * a quick explanation without running a full analysis.
 *
 * @param {string} clauseText - The clause text to summarize
 * @param {string} [contractType] - Optional context about the contract type
 * @returns {Promise<object>} { summary, implications, actionItems }
 */
export async function summarizeClause(clauseText, contractType = '') {
    const contextHint = contractType ? ` This clause is from a "${contractType}" contract.` : '';

    const messages = [
        {
            role: 'system',
            content: 'You are a legal contract analyst. Return only valid JSON. This is AI analysis, not legal advice.',
        },
        {
            role: 'user',
            content: `Summarize the following contract clause in plain English.${contextHint} Return a JSON object:

{
  "summary": "Plain English summary of what this clause means (2-3 sentences)",
  "implications": ["List of practical implications for the signing party"],
  "actionItems": ["Specific things the signing party should do or watch out for"],
  "riskLevel": "<low|medium|high>",
  "isStandard": true/false  // Whether this is a standard/boilerplate clause
}

Clause:
${clauseText}`,
        },
    ];

    try {
        const response = await gateway.chatCompletion(messages, {
            model: env.AI_FALLBACK_MODEL, // Fast model for quick summaries
            temperature: 0.2,
            maxTokens: 1024,
            responseFormat: { type: 'json_object' },
        });

        const parsed = parseJSON(response.content);
        return {
            summary: parsed.summary || 'Unable to summarize this clause.',
            implications: Array.isArray(parsed.implications) ? parsed.implications : [],
            actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
            riskLevel: ['low', 'medium', 'high'].includes(parsed.riskLevel) ? parsed.riskLevel : 'medium',
            isStandard: typeof parsed.isStandard === 'boolean' ? parsed.isStandard : false,
            tokensUsed: response.tokensUsed,
            provider: response.provider,
            latencyMs: response.latencyMs,
        };
    } catch (err) {
        logger.error('Clause summarization failed:', err.message);
        throw new Error(`AI clause summarization failed: ${err.message}`);
    }
}

// ─────────────────────────────────────────────────────────────────
//  4. CONTRACT Q&A (NEW)
// ─────────────────────────────────────────────────────────────────

/**
 * Ask a question about a contract — conversational AI over legal documents.
 * Enables a "chat with your contract" feature.
 *
 * @param {string} contractContent - Full contract text
 * @param {string} question - User's question about the contract
 * @param {Array} [chatHistory=[]] - Prior Q&A turns for context continuity
 * @returns {Promise<object>} { answer, confidence, relatedClauses }
 */
export async function askContractQuestion(contractContent, question, chatHistory = []) {
    // Cap contract text to stay within context windows
    const truncated = contractContent.length > 12000
        ? `${contractContent.substring(0, 12000)}\n\n[Content truncated]`
        : contractContent;

    const messages = [
        {
            role: 'system',
            content: `You are a legal contract analyst assistant. The user has uploaded a contract and wants to ask questions about it. Answer based ONLY on the contract content provided. If the answer is not in the contract, say so. Return valid JSON. This is AI analysis, not legal advice.

Contract text:
${truncated}`,
        },
        // Include up to last 6 turns of chat history for context continuity
        ...chatHistory.slice(-6),
        {
            role: 'user',
            content: `Answer this question about the contract above. Return a JSON object:

{
  "answer": "Direct answer to the question in plain English",
  "confidence": "<high|medium|low>",
  "relatedClauses": ["Relevant clause titles or sections that support this answer"],
  "caveat": "Any important caveats or limitations to the answer"
}

Question: ${question}`,
        },
    ];

    try {
        const response = await gateway.chatCompletion(messages, {
            model: env.AI_PRIMARY_MODEL,
            temperature: 0.3,
            maxTokens: 1536,
            responseFormat: { type: 'json_object' },
        });

        const parsed = parseJSON(response.content);
        return {
            answer: parsed.answer || 'Unable to answer this question based on the contract.',
            confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
            relatedClauses: Array.isArray(parsed.relatedClauses) ? parsed.relatedClauses : [],
            caveat: parsed.caveat || '',
            tokensUsed: response.tokensUsed,
            provider: response.provider,
            latencyMs: response.latencyMs,
        };
    } catch (err) {
        logger.error('Contract Q&A failed:', err.message);
        throw new Error(`AI Q&A failed: ${err.message}`);
    }
}

// ─────────────────────────────────────────────────────────────────
//  5. KEY TERMS EXTRACTION (NEW)
// ─────────────────────────────────────────────────────────────────

/**
 * Extract key terms and definitions from a contract.
 * Provides a quick glossary of defined terms for the user.
 *
 * @param {string} contractContent - Full contract text
 * @returns {Promise<object>} { terms, parties, governingLaw, jurisdiction }
 */
export async function extractKeyTerms(contractContent) {
    const truncated = contractContent.length > 15000
        ? `${contractContent.substring(0, 15000)}\n\n[Content truncated]`
        : contractContent;

    const messages = [
        {
            role: 'system',
            content: 'You are a legal contract analyst. Return only valid JSON. This is AI analysis, not legal advice.',
        },
        {
            role: 'user',
            content: `Extract all key terms, definitions, and important metadata from this contract. Return a JSON object:

{
  "terms": [
    {
      "term": "Defined term name",
      "definition": "The definition from the contract",
      "section": "Section/clause where it appears"
    }
  ],
  "parties": [
    { "name": "Full legal name", "role": "Role in the contract", "type": "individual|company|government" }
  ],
  "contractType": "Type of contract (e.g. NDA, SaaS Agreement, Employment)",
  "governingLaw": "Governing law / jurisdiction",
  "currency": "Currency used for financial terms (or empty string)",
  "totalValue": "Total contract value if specified (or empty string)",
  "duration": "Contract duration / term"
}

Contract:
${truncated}`,
        },
    ];

    try {
        const response = await gateway.chatCompletion(messages, {
            model: env.AI_FALLBACK_MODEL,
            temperature: 0.1,
            maxTokens: 2048,
            responseFormat: { type: 'json_object' },
        });

        const parsed = parseJSON(response.content);
        return {
            terms: Array.isArray(parsed.terms) ? parsed.terms : [],
            parties: Array.isArray(parsed.parties) ? parsed.parties : [],
            contractType: parsed.contractType || 'Unknown',
            governingLaw: parsed.governingLaw || '',
            currency: parsed.currency || '',
            totalValue: parsed.totalValue || '',
            duration: parsed.duration || '',
            tokensUsed: response.tokensUsed,
            provider: response.provider,
            latencyMs: response.latencyMs,
        };
    } catch (err) {
        logger.error('Key terms extraction failed:', err.message);
        throw new Error(`AI key terms extraction failed: ${err.message}`);
    }
}

// ─────────────────────────────────────────────────────────────────
//  6. RISK EXPLANATION (NEW)
// ─────────────────────────────────────────────────────────────────

/**
 * Generate a detailed explanation of a contract's risk score.
 * Useful when the user wants to understand WHY the overall score is what it is.
 *
 * @param {object} analysisResult - The full analysis result from analyzeContract()
 * @returns {Promise<object>} { explanation, topRisks, mitigations }
 */
export async function explainRisk(analysisResult) {
    const { summary, riskScore, riskLevel, clauses } = analysisResult;

    const clausesSummary = (clauses || [])
        .filter(c => c.flag === 'red' || c.flag === 'yellow')
        .map(c => `- [${c.flag.toUpperCase()}] ${c.title}: ${c.explanation}`)
        .join('\n');

    const messages = [
        {
            role: 'system',
            content: 'You are a legal risk analyst. Return only valid JSON. This is AI analysis, not legal advice.',
        },
        {
            role: 'user',
            content: `A contract has been analyzed with the following results:
- Risk Score: ${riskScore}/100
- Risk Level: ${riskLevel}
- Summary: ${summary}
- Flagged Clauses:
${clausesSummary || 'None flagged'}

Explain WHY this contract received this risk score and what the user should do. Return a JSON object:

{
  "explanation": "Clear, non-technical explanation of why the contract is risky or safe (2-3 paragraphs)",
  "topRisks": [
    {
      "risk": "Name of the risk",
      "severity": "<low|medium|high|critical>",
      "description": "What could go wrong"
    }
  ],
  "mitigations": ["Actionable steps to reduce risk before signing"],
  "overallRecommendation": "<sign|negotiate|reject|consult-lawyer>"
}`,
        },
    ];

    try {
        const response = await gateway.chatCompletion(messages, {
            model: env.AI_PRIMARY_MODEL,
            temperature: 0.2,
            maxTokens: 2048,
            responseFormat: { type: 'json_object' },
        });

        const parsed = parseJSON(response.content);
        return {
            explanation: parsed.explanation || 'Unable to generate risk explanation.',
            topRisks: Array.isArray(parsed.topRisks) ? parsed.topRisks : [],
            mitigations: Array.isArray(parsed.mitigations) ? parsed.mitigations : [],
            overallRecommendation: parsed.overallRecommendation || 'consult-lawyer',
            tokensUsed: response.tokensUsed,
            provider: response.provider,
            latencyMs: response.latencyMs,
        };
    } catch (err) {
        logger.error('Risk explanation failed:', err.message);
        throw new Error(`AI risk explanation failed: ${err.message}`);
    }
}

// ─────────────────────────────────────────────────────────────────
//  7. CONTRACT TRANSLATION (NEW)
// ─────────────────────────────────────────────────────────────────

/**
 * Translate a contract summary and key clauses into another language.
 * Does NOT translate the full contract (too expensive) — translates
 * the analysis output so non-English speakers can understand the findings.
 *
 * @param {object} analysisResult - The analysis result to translate
 * @param {string} targetLanguage - Target language (e.g. 'Spanish', 'Hindi', 'French')
 * @returns {Promise<object>} Translated analysis summary
 */
export async function translateAnalysis(analysisResult, targetLanguage) {
    const { summary, clauses, obligations } = analysisResult;

    const clauseTexts = (clauses || []).slice(0, 5).map(c =>
        `- ${c.title}: ${c.explanation}`
    ).join('\n');

    const messages = [
        {
            role: 'system',
            content: `You are a professional legal translator. Translate the following contract analysis into ${targetLanguage}. Preserve legal accuracy. Return valid JSON.`,
        },
        {
            role: 'user',
            content: `Translate this contract analysis to ${targetLanguage}. Return a JSON object:

{
  "translatedSummary": "Translated summary",
  "translatedClauses": [
    { "title": "Translated title", "explanation": "Translated explanation" }
  ],
  "translatedObligations": {
    "yourObligations": ["Translated obligations"],
    "otherPartyObligations": ["Translated obligations"]
  },
  "targetLanguage": "${targetLanguage}"
}

Original Summary: ${summary}

Key Clauses:
${clauseTexts || 'None'}

Your Obligations: ${JSON.stringify(obligations?.yourObligations || [])}
Other Party Obligations: ${JSON.stringify(obligations?.otherPartyObligations || [])}`,
        },
    ];

    try {
        const response = await gateway.chatCompletion(messages, {
            model: env.AI_FALLBACK_MODEL,
            temperature: 0.1,
            maxTokens: 2048,
            responseFormat: { type: 'json_object' },
        });

        const parsed = parseJSON(response.content);
        return {
            translatedSummary: parsed.translatedSummary || '',
            translatedClauses: Array.isArray(parsed.translatedClauses) ? parsed.translatedClauses : [],
            translatedObligations: parsed.translatedObligations || { yourObligations: [], otherPartyObligations: [] },
            targetLanguage,
            tokensUsed: response.tokensUsed,
            provider: response.provider,
            latencyMs: response.latencyMs,
        };
    } catch (err) {
        logger.error('Translation failed:', err.message);
        throw new Error(`AI translation failed: ${err.message}`);
    }
}

// ─────────────────────────────────────────────────────────────────
//  8. COMPLIANCE CHECK (NEW)
// ─────────────────────────────────────────────────────────────────

/**
 * Check a contract against a specific regulatory framework.
 * Supports GDPR, HIPAA, SOX, PCI-DSS, and general best practices.
 *
 * @param {string} contractContent - Full contract text
 * @param {string} framework - Regulatory framework to check against
 * @returns {Promise<object>} { compliant, issues, recommendations, score }
 */
export async function checkCompliance(contractContent, framework = 'GDPR') {
    const truncated = contractContent.length > 15000
        ? `${contractContent.substring(0, 15000)}\n\n[Content truncated]`
        : contractContent;

    const messages = [
        {
            role: 'system',
            content: `You are a legal compliance analyst specializing in ${framework}. Return only valid JSON. This is AI analysis, not legal advice — recommend consulting a compliance officer.`,
        },
        {
            role: 'user',
            content: `Analyze this contract for ${framework} compliance. Return a JSON object:

{
  "framework": "${framework}",
  "complianceScore": <number 0-100>,
  "compliant": true/false,
  "issues": [
    {
      "requirement": "The specific ${framework} requirement",
      "status": "<compliant|non-compliant|partially-compliant|not-applicable>",
      "finding": "What the contract says (or doesn't say)",
      "recommendation": "How to fix the issue"
    }
  ],
  "missingClauses": ["Required clauses that are completely absent"],
  "recommendations": ["Top-level recommendations for achieving compliance"],
  "disclaimer": "This is automated AI analysis and should not replace professional compliance review"
}

Contract:
${truncated}`,
        },
    ];

    try {
        const response = await gateway.chatCompletion(messages, {
            model: env.AI_PRIMARY_MODEL,
            temperature: 0.1,
            maxTokens: 3072,
            responseFormat: { type: 'json_object' },
        });

        const parsed = parseJSON(response.content);
        return {
            framework,
            complianceScore: typeof parsed.complianceScore === 'number' ? parsed.complianceScore : 50,
            compliant: typeof parsed.compliant === 'boolean' ? parsed.compliant : false,
            issues: Array.isArray(parsed.issues) ? parsed.issues : [],
            missingClauses: Array.isArray(parsed.missingClauses) ? parsed.missingClauses : [],
            recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
            disclaimer: parsed.disclaimer || 'This is automated AI analysis and should not replace professional compliance review.',
            tokensUsed: response.tokensUsed,
            provider: response.provider,
            latencyMs: response.latencyMs,
        };
    } catch (err) {
        logger.error('Compliance check failed:', err.message);
        throw new Error(`AI compliance check failed: ${err.message}`);
    }
}

// ─────────────────────────────────────────────────────────────────
//  PROMPT BUILDERS (unchanged from original)
// ─────────────────────────────────────────────────────────────────

/**
 * Build the system prompt — sets the AI's persona and constraints.
 */
function buildSystemPrompt() {
    return `You are a legal contract analyst. Your job is to analyze contracts and return structured JSON. Never give legal advice. Always label output as "AI analysis, not legal advice." Always return valid JSON.`;
}

/**
 * Build the user prompt with the contract content.
 * Truncates very long contracts to avoid hitting token limits.
 */
function buildUserPrompt(content) {
    // Cap at 15k chars to stay within model context windows
    const truncated = content.length > 15000
        ? `${content.substring(0, 15000)}\n\n[Content truncated for analysis]`
        : content;

    return `Analyze the following contract and return ONLY a JSON object with this exact structure:
{
  "summary": "A single plain-English paragraph summarizing the contract, its key risk areas, and what the signing party should be aware of. This is NOT a bullet list.",
  "riskScore": <number 0-100>,
  "riskLevel": "<low|medium|high|critical>",
  "clauses": [
    {
      "title": "Clause title",
      "content": "Relevant clause text",
      "flag": "<green|yellow|red>",
      "explanation": "Plain English explanation of what this clause means",
      "suggestion": "What the signing party should negotiate or watch out for"
    }
  ],
  "obligations": {
    "yourObligations": ["List of obligations for the signing party"],
    "otherPartyObligations": ["List of obligations for the other party"]
  },
  "keyDates": {
    "effectiveDate": "YYYY-MM-DD or empty string",
    "expiryDate": "YYYY-MM-DD or empty string",
    "renewalDate": "YYYY-MM-DD or empty string",
    "noticePeriod": "e.g. 30 days or empty string"
  },
  "parties": [
    { "name": "Party name", "role": "Party role (e.g. Vendor, Client)" }
  ]
}

Contract text:
${truncated}`;
}

// ─────────────────────────────────────────────────────────────────
//  RESPONSE PARSERS
// ─────────────────────────────────────────────────────────────────

/**
 * Generic JSON parser — extracts JSON from raw LLM output.
 * Handles: raw JSON, markdown code blocks, JSON embedded in prose.
 *
 * @param {string} rawContent - Raw string from LLM
 * @returns {object} Parsed JSON object
 */
function parseJSON(rawContent) {
    try {
        return JSON.parse(rawContent);
    } catch {
        // Try extracting from markdown code blocks (```json ... ```)
        const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[1]);
        }
        // Last resort: find first { and last }
        const start = rawContent.indexOf('{');
        const end = rawContent.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            return JSON.parse(rawContent.substring(start, end + 1));
        }
        throw new Error('Could not extract valid JSON from AI response');
    }
}

/**
 * Parse and validate the AI's JSON response for contract analysis.
 * Missing/invalid fields get safe defaults so downstream code never crashes.
 */
function parseAIResponse(rawContent) {
    const parsed = parseJSON(rawContent);

    // ─── Validate and apply safe defaults ──────────────────────
    if (typeof parsed.riskScore !== 'number') parsed.riskScore = 50;
    if (!['low', 'medium', 'high', 'critical'].includes(parsed.riskLevel)) {
        parsed.riskLevel = parsed.riskScore <= 25 ? 'low'
            : parsed.riskScore <= 50 ? 'medium'
                : parsed.riskScore <= 75 ? 'high'
                    : 'critical';
    }
    if (!parsed.summary || typeof parsed.summary !== 'string') {
        parsed.summary = 'AI analysis could not generate a summary for this contract.';
    }
    if (!Array.isArray(parsed.clauses)) parsed.clauses = [];
    if (!parsed.obligations) parsed.obligations = { yourObligations: [], otherPartyObligations: [] };
    if (!parsed.keyDates) parsed.keyDates = {};
    if (!Array.isArray(parsed.parties)) parsed.parties = [];

    return parsed;
}

// ─────────────────────────────────────────────────────────────────
//  GATEWAY DIAGNOSTICS
// ─────────────────────────────────────────────────────────────────

/**
 * Get provider health/configuration status.
 * Useful for admin dashboards and health check endpoints.
 *
 * @returns {object} Provider status map
 */
export function getProviderStatus() {
    return gateway.getProviderStatus();
}
