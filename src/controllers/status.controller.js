/**
 * Status Controller
 *
 * Thin HTTP layer for contract lifecycle status/workflow management.
 */

import * as statusService from '../services/status.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

/** GET /contracts/:id/status — get current workflow status */
export async function getContractStatus(req, res) {
    const { orgId } = req;
    const status = await statusService.getContractStatus(req.params.id, orgId);
    sendSuccess(res, { data: { status } });
}

/** PATCH /contracts/:id/status — update workflow status */
export async function updateContractStatus(req, res) {
    const { orgId } = req;
    const result = await statusService.updateContractStatus(
        req.params.id,
        orgId,
        req.user.userId,
        req.body.status,
        req.body.note
    );
    sendSuccess(res, { message: `Contract status updated to "${result.currentStatus}".`, data: { status: result } });
}

/** GET /contracts/:id/status/history — get status change history */
export async function getStatusHistory(req, res) {
    const { orgId } = req;
    const history = await statusService.getStatusHistory(req.params.id, orgId);
    sendSuccess(res, { data: { history } });
}
