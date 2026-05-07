/**
 * Bulk Operations Controller
 *
 * Thin HTTP layer for batch contract operations.
 * All operations require admin or manager role (enforced at route level).
 */

import * as bulkService from '../services/bulk.service.js';
import { emitBulkComplete, emitBulkFailed } from '../services/socketEmitter.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

/** POST /bulk/add-tags — add tags to multiple contracts */
export async function bulkAddTags(req, res) {
    const { orgId } = req;
    try {
        const result = await bulkService.bulkAddTags(orgId, req.user.userId, req.body);
        emitBulkComplete(req.user.userId, {
            operation: 'bulk_add_tags',
            modifiedCount: result.modifiedCount,
            contractIds: req.body.contractIds,
        });
        sendSuccess(res, { message: `Tags added to ${result.modifiedCount} contracts.`, data: result });
    } catch (err) {
        emitBulkFailed(req.user.userId, { operation: 'bulk_add_tags', error: err.message });
        throw err;
    }
}

/** POST /bulk/remove-tags — remove tags from multiple contracts */
export async function bulkRemoveTags(req, res) {
    const { orgId } = req;
    try {
        const result = await bulkService.bulkRemoveTags(orgId, req.user.userId, req.body);
        emitBulkComplete(req.user.userId, {
            operation: 'bulk_remove_tags',
            modifiedCount: result.modifiedCount,
            contractIds: req.body.contractIds,
        });
        sendSuccess(res, { message: `Tags removed from ${result.modifiedCount} contracts.`, data: result });
    } catch (err) {
        emitBulkFailed(req.user.userId, { operation: 'bulk_remove_tags', error: err.message });
        throw err;
    }
}

/** POST /bulk/delete — soft-delete multiple contracts */
export async function bulkDelete(req, res) {
    const { orgId } = req;
    try {
        const result = await bulkService.bulkDelete(orgId, req.user.userId, req.body);
        emitBulkComplete(req.user.userId, {
            operation: 'bulk_delete',
            modifiedCount: result.deletedCount,
            contractIds: req.body.contractIds,
        });
        sendSuccess(res, { message: `${result.deletedCount} contracts deleted.`, data: result });
    } catch (err) {
        emitBulkFailed(req.user.userId, { operation: 'bulk_delete', error: err.message });
        throw err;
    }
}

/** POST /bulk/update-type — change type for multiple contracts */
export async function bulkUpdateType(req, res) {
    const { orgId } = req;
    try {
        const result = await bulkService.bulkUpdateType(orgId, req.user.userId, req.body);
        emitBulkComplete(req.user.userId, {
            operation: 'bulk_update_type',
            modifiedCount: result.modifiedCount,
            contractIds: req.body.contractIds,
        });
        sendSuccess(res, { message: `Type updated for ${result.modifiedCount} contracts.`, data: result });
    } catch (err) {
        emitBulkFailed(req.user.userId, { operation: 'bulk_update_type', error: err.message });
        throw err;
    }
}
