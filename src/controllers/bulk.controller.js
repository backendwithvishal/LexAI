/**
 * Bulk Operations Controller
 *
 * Thin HTTP layer for batch contract operations.
 * All operations require admin or manager role (enforced at route level).
 */

import * as bulkService from '../services/bulk.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

/** POST /bulk/add-tags — add tags to multiple contracts */
export async function bulkAddTags(req, res) {
    const { orgId } = req;
    const result = await bulkService.bulkAddTags(orgId, req.user.userId, req.body);
    sendSuccess(res, { message: `Tags added to ${result.modifiedCount} contracts.`, data: result });
}

/** POST /bulk/remove-tags — remove tags from multiple contracts */
export async function bulkRemoveTags(req, res) {
    const { orgId } = req;
    const result = await bulkService.bulkRemoveTags(orgId, req.user.userId, req.body);
    sendSuccess(res, { message: `Tags removed from ${result.modifiedCount} contracts.`, data: result });
}

/** POST /bulk/delete — soft-delete multiple contracts */
export async function bulkDelete(req, res) {
    const { orgId } = req;
    const result = await bulkService.bulkDelete(orgId, req.user.userId, req.body);
    sendSuccess(res, { message: `${result.deletedCount} contracts deleted.`, data: result });
}

/** POST /bulk/update-type — change type for multiple contracts */
export async function bulkUpdateType(req, res) {
    const { orgId } = req;
    const result = await bulkService.bulkUpdateType(orgId, req.user.userId, req.body);
    sendSuccess(res, { message: `Type updated for ${result.modifiedCount} contracts.`, data: result });
}
