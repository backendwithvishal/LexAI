/**
 * Export Controller
 *
 * Thin HTTP layer for data export endpoints.
 * Returns JSON with Content-Disposition header for download.
 */

import * as exportService from '../services/export.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

/** GET /exports/contracts — export contracts list */
export async function exportContracts(req, res) {
    const { orgId } = req;
    const result = await exportService.exportContracts(orgId, req.query);
    sendSuccess(res, { data: result });
}

/** GET /exports/contracts/:id/report — export single contract report */
export async function exportContractReport(req, res) {
    const { orgId } = req;
    const report = await exportService.exportContractReport(req.params.id, orgId);
    sendSuccess(res, { data: { report } });
}

/** GET /exports/analyses — export analyses summary */
export async function exportAnalyses(req, res) {
    const { orgId } = req;
    const result = await exportService.exportAnalyses(orgId, req.query);
    sendSuccess(res, { data: result });
}
