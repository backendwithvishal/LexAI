/**
 * AI Controller
 *
 * Thin HTTP layer for AI-powered features beyond basic contract analysis.
 * Each handler validates input, calls the ai.service, and returns a
 * standardized response.
 *
 * Endpoints:
 *   POST /ai/summarize-clause  — Summarize a single clause
 *   POST /ai/ask               — Ask a question about a contract
 *   POST /ai/extract-terms     — Extract key terms and definitions
 *   POST /ai/explain-risk      — Explain an analysis risk score
 *   POST /ai/translate         — Translate analysis into another language
 *   POST /ai/compliance        — Check contract compliance against a framework
 *   GET  /ai/providers         — Get provider health/configuration status
 */

import * as aiService from '../services/ai.service.js';
import * as analysisService from '../services/analysis.service.js';
import Contract from '../models/Contract.model.js';
import { sendSuccess } from '../utils/apiResponse.js';
import AppError from '../utils/AppError.js';

// ─────────────────────────────────────────────────────────────────
// POST /ai/summarize-clause
// ─────────────────────────────────────────────────────────────────

/** Summarize a contract clause in plain English. */
export async function summarizeClause(req, res) {
    const { clauseText, contractType } = req.body;

    const result = await aiService.summarizeClause(clauseText, contractType);

    sendSuccess(res, {
        message: 'Clause summarized successfully.',
        data: result,
    });
}

// ─────────────────────────────────────────────────────────────────
// POST /ai/ask
// ─────────────────────────────────────────────────────────────────

/** Ask a question about a contract — "chat with your contract". */
export async function askQuestion(req, res) {
    const { contractId, question, chatHistory } = req.body;
    const { orgId } = req;

    // Fetch contract — enforce org isolation
    const contract = await Contract.findOne({ _id: contractId, orgId, isDeleted: false });
    if (!contract) {
        throw new AppError('Contract not found.', 404, 'NOT_FOUND');
    }

    const result = await aiService.askContractQuestion(
        contract.content,
        question,
        chatHistory
    );

    sendSuccess(res, {
        message: 'Question answered successfully.',
        data: result,
    });
}

// ─────────────────────────────────────────────────────────────────
// POST /ai/extract-terms
// ─────────────────────────────────────────────────────────────────

/** Extract key terms, parties, and definitions from a contract. */
export async function extractTerms(req, res) {
    const { contractId } = req.body;
    const { orgId } = req;

    const contract = await Contract.findOne({ _id: contractId, orgId, isDeleted: false });
    if (!contract) {
        throw new AppError('Contract not found.', 404, 'NOT_FOUND');
    }

    const result = await aiService.extractKeyTerms(contract.content);

    sendSuccess(res, {
        message: 'Key terms extracted successfully.',
        data: result,
    });
}

// ─────────────────────────────────────────────────────────────────
// POST /ai/explain-risk
// ─────────────────────────────────────────────────────────────────

/** Explain why a contract received its risk score. */
export async function explainRisk(req, res) {
    const { analysisId } = req.body;
    const { orgId } = req;

    // Fetch the analysis result — enforce org isolation
    const analysis = await analysisService.getAnalysis(analysisId, orgId);

    const result = await aiService.explainRisk(analysis);

    sendSuccess(res, {
        message: 'Risk explanation generated successfully.',
        data: result,
    });
}

// ─────────────────────────────────────────────────────────────────
// POST /ai/translate
// ─────────────────────────────────────────────────────────────────

/** Translate a contract analysis into another language. */
export async function translateAnalysis(req, res) {
    const { analysisId, targetLanguage } = req.body;
    const { orgId } = req;

    const analysis = await analysisService.getAnalysis(analysisId, orgId);

    const result = await aiService.translateAnalysis(analysis, targetLanguage);

    sendSuccess(res, {
        message: `Analysis translated to ${targetLanguage} successfully.`,
        data: result,
    });
}

// ─────────────────────────────────────────────────────────────────
// POST /ai/compliance
// ─────────────────────────────────────────────────────────────────

/** Check a contract's compliance against a regulatory framework. */
export async function checkCompliance(req, res) {
    const { contractId, framework } = req.body;
    const { orgId } = req;

    const contract = await Contract.findOne({ _id: contractId, orgId, isDeleted: false });
    if (!contract) {
        throw new AppError('Contract not found.', 404, 'NOT_FOUND');
    }

    const result = await aiService.checkCompliance(contract.content, framework);

    sendSuccess(res, {
        message: `${framework} compliance check completed.`,
        data: result,
    });
}

// ─────────────────────────────────────────────────────────────────
// GET /ai/providers
// ─────────────────────────────────────────────────────────────────

/** Get current AI provider configuration and health status. */
export async function getProviderStatus(req, res) {
    const status = aiService.getProviderStatus();

    sendSuccess(res, {
        message: 'AI provider status retrieved.',
        data: { providers: status },
    });
}
