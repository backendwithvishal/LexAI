/**
 * Report Controller
 *
 * Thin HTTP layer for compliance and analytics reports.
 */

import * as reportService from '../services/report.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

/** GET /reports/compliance — compliance summary report */
export async function getComplianceReport(req, res) {
    const { orgId } = req;
    const report = await reportService.getComplianceReport(orgId);
    sendSuccess(res, { data: { report } });
}

/** GET /reports/risk-trend — risk score trends over 6 months */
export async function getRiskTrendReport(req, res) {
    const { orgId } = req;
    const report = await reportService.getRiskTrendReport(orgId);
    sendSuccess(res, { data: { report } });
}

/** GET /reports/activity — org activity report */
export async function getActivityReport(req, res) {
    const { orgId } = req;
    const report = await reportService.getActivityReport(orgId, req.query);
    sendSuccess(res, { data: { report } });
}
