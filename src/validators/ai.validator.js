/**
 * AI Validators — Joi schemas for AI service endpoints.
 *
 * Validates request bodies for all AI-powered features:
 *   - Clause summarization
 *   - Contract Q&A
 *   - Key terms extraction
 *   - Risk explanation
 *   - Analysis translation
 *   - Compliance checking
 *   - Provider status (no body needed)
 */

import Joi from 'joi';

/** POST /ai/summarize-clause */
export const summarizeClause = Joi.object({
    clauseText: Joi.string().min(10).max(10000).required()
        .messages({ 'any.required': 'clauseText is required' }),
    contractType: Joi.string().max(100).optional().default(''),
});

/** POST /ai/ask */
export const askQuestion = Joi.object({
    contractId: Joi.string().hex().length(24).required()
        .messages({ 'any.required': 'contractId is required' }),
    question: Joi.string().min(5).max(1000).required()
        .messages({ 'any.required': 'question is required' }),
    chatHistory: Joi.array().items(
        Joi.object({
            role: Joi.string().valid('user', 'assistant').required(),
            content: Joi.string().max(5000).required(),
        })
    ).max(20).optional().default([]),
});

/** POST /ai/extract-terms */
export const extractTerms = Joi.object({
    contractId: Joi.string().hex().length(24).required()
        .messages({ 'any.required': 'contractId is required' }),
});

/** POST /ai/explain-risk */
export const explainRisk = Joi.object({
    analysisId: Joi.string().hex().length(24).required()
        .messages({ 'any.required': 'analysisId is required' }),
});

/** POST /ai/translate */
export const translateAnalysis = Joi.object({
    analysisId: Joi.string().hex().length(24).required()
        .messages({ 'any.required': 'analysisId is required' }),
    targetLanguage: Joi.string().min(2).max(50).required()
        .messages({ 'any.required': 'targetLanguage is required (e.g. Spanish, Hindi, French)' }),
});

/** POST /ai/compliance */
export const checkCompliance = Joi.object({
    contractId: Joi.string().hex().length(24).required()
        .messages({ 'any.required': 'contractId is required' }),
    framework: Joi.string().valid('GDPR', 'HIPAA', 'SOX', 'PCI-DSS', 'CCPA', 'GENERAL').default('GDPR')
        .messages({ 'any.only': 'framework must be one of: GDPR, HIPAA, SOX, PCI-DSS, CCPA, GENERAL' }),
});
