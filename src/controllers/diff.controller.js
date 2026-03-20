/**
 * Diff Controller
 *
 * Handles contract version comparison requests.
 * The text diff is generated synchronously; the AI explanation is async via RabbitMQ.
 * Client should listen on WebSocket for the 'diff:complete' event.
 */

import * as diffService from '../services/diff.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import HTTP from '../constants/httpStatus.js';

/** POST /contracts/:id/compare — compare two versions of a contract */
export async function compareVersions(req, res) {
    const { orgId } = req;

    // Service checks plan access (Pro/Enterprise only) and queues the AI explanation job
    const result = await diffService.compareVersions({
        contractId: req.params.id,
        orgId,
        userId: req.user.userId,
        versionA: req.body.versionA,
        versionB: req.body.versionB,
    });

    // 202 Accepted — the AI explanation will arrive via WebSocket, not in this response
    sendSuccess(res, {
        statusCode: HTTP.ACCEPTED,
        message: 'Version comparison queued. You will be notified via WebSocket when complete.',
        data: result,
    });
}
