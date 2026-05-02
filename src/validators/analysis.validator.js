/**
 * Analysis Validators — Joi schemas for analysis endpoints.
 *
 * contractId must be a valid MongoDB ObjectId (24-char hex string).
 * version is optional — defaults to null which means "analyze current version".
 */

import Joi from 'joi';

export const requestAnalysis = Joi.object({
    // MongoDB ObjectId — 24 hex characters
    contractId: Joi.string().hex().length(24).required()
        .messages({ 'any.required': 'contractId is required' }),
    // Which version to analyze — null means use the latest version
    version: Joi.number().integer().min(1).optional().default(null),
});

// DELETE /analyses/:id — validate the :id path param
export const deleteAnalysis = Joi.object({
    id: Joi.string().hex().length(24).required()
        .messages({ 'any.required': 'Analysis id is required', 'string.length': 'id must be a valid MongoDB ObjectId' }),
});

// DELETE /analyses/contract/:contractId — validate the :contractId path param
export const deleteByContract = Joi.object({
    contractId: Joi.string().hex().length(24).required()
        .messages({ 'any.required': 'contractId is required', 'string.length': 'contractId must be a valid MongoDB ObjectId' }),
});