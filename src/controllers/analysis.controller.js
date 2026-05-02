/**
 * Analysis Controller
 *
 * Thin HTTP layer for AI analysis requests.
 * All business logic (caching, queuing, quota) lives in analysis.service.js.
 * Errors thrown by the service bubble up to the global error handler.
 */

import * as analysisService from '../services/analysis.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import HTTP from '../constants/httpStatus.js';

/** POST /analyses — queue a new AI analysis job for a contract */
export async function requestAnalysis(req, res) {
    const { orgId } = req;

    // Service checks cache first — if a result already exists for this content hash,
    // it returns immediately without queuing a new job
    const result = await analysisService.requestAnalysis({
        contractId: req.body.contractId,
        orgId,
        userId: req.user.userId,
        version: req.body.version,
    });

    if (result.cached) {
        // Cache hit — return the existing result right away
        sendSuccess(res, { message: 'Analysis result retrieved from cache.', data: result });
    } else {
        // Job queued — client should listen on WebSocket for the completion event
        sendSuccess(res, {
            statusCode: HTTP.ACCEPTED,
            message: 'Analysis job queued. You will receive a WebSocket notification when complete.',
            data: {
                analysisId: result.analysisId,
                status: result.status,
                estimatedSeconds: result.estimatedSeconds || 30,
            },
        });
    }
}

/** GET /analyses/:id — get a single analysis result by ID */
export async function getAnalysis(req, res) {
    const { orgId } = req;
    // orgId enforces org isolation — can't access another org's analysis
    const analysis = await analysisService.getAnalysis(req.params.id, orgId);
    sendSuccess(res, { data: { analysis } });
}

/** GET /analyses/contract/:contractId — list all analyses for a contract */
export async function getAnalysesByContract(req, res) {
    const { orgId } = req;
    // Returns light listing (no clauses/obligations) — use GET /analyses/:id for full data
    const analyses = await analysisService.getAnalysesByContract(req.params.contractId, orgId);
    sendSuccess(res, { data: { analyses } });
}

/** DELETE /analyses/:id — permanently delete a single analysis by ID */
export async function deleteAnalysis(req, res) {
    const { orgId } = req;
    const { analysisId } = await analysisService.deleteAnalysis(req.params.id, orgId, req.user.userId);
    sendSuccess(res, { message: 'Analysis deleted.', data: { analysisId } });
}

/** DELETE /analyses/contract/:contractId — permanently delete all analyses for a contract */
export async function deleteAnalysesByContract(req, res) {
    const { orgId } = req;
    const { deletedCount } = await analysisService.deleteAnalysesByContract(req.params.contractId, orgId, req.user.userId);
    sendSuccess(res, {
        message: `${deletedCount} ${deletedCount === 1 ? 'analysis' : 'analyses'} deleted.`,
        data: { deletedCount },
    });
}
