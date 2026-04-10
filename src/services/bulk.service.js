/**
 * Bulk Operations Service
 *
 * Batch operations on contracts for power users and admins.
 * All operations enforce org isolation and return counts
 * of affected documents.
 *
 * Note: Bulk operations are audited but with a single log entry
 * (not one per document) to avoid log flooding.
 */

import Contract from '../models/Contract.model.js';
import * as auditService from './audit.service.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

/**
 * Add tags to multiple contracts at once.
 */
export async function bulkAddTags(orgId, userId, { contractIds, tags }) {
    if (!contractIds || contractIds.length === 0) {
        throw new AppError('At least one contract ID is required.', 400, 'INVALID_INPUT');
    }
    if (!tags || tags.length === 0) {
        throw new AppError('At least one tag is required.', 400, 'INVALID_INPUT');
    }

    const normalizedTags = tags.map((t) => t.trim().toLowerCase()).filter(Boolean);

    const result = await Contract.updateMany(
        { _id: { $in: contractIds }, orgId, isDeleted: false },
        { $addToSet: { tags: { $each: normalizedTags } } }
    );

    logger.info({ orgId, userId, contractCount: result.modifiedCount, tags: normalizedTags }, 'Bulk tags added');

    await auditService.log({
        orgId,
        userId,
        action: 'contract.bulk_tags_added',
        resourceType: 'Contract',
        metadata: { contractIds, tags: normalizedTags, modifiedCount: result.modifiedCount },
    });

    return { modifiedCount: result.modifiedCount, tags: normalizedTags };
}

/**
 * Remove tags from multiple contracts at once.
 */
export async function bulkRemoveTags(orgId, userId, { contractIds, tags }) {
    if (!contractIds || contractIds.length === 0) {
        throw new AppError('At least one contract ID is required.', 400, 'INVALID_INPUT');
    }
    if (!tags || tags.length === 0) {
        throw new AppError('At least one tag is required.', 400, 'INVALID_INPUT');
    }

    const normalizedTags = tags.map((t) => t.trim().toLowerCase()).filter(Boolean);

    const result = await Contract.updateMany(
        { _id: { $in: contractIds }, orgId, isDeleted: false },
        { $pullAll: { tags: normalizedTags } }
    );

    logger.info({ orgId, userId, contractCount: result.modifiedCount, tags: normalizedTags }, 'Bulk tags removed');

    await auditService.log({
        orgId,
        userId,
        action: 'contract.bulk_tags_removed',
        resourceType: 'Contract',
        metadata: { contractIds, tags: normalizedTags, modifiedCount: result.modifiedCount },
    });

    return { modifiedCount: result.modifiedCount, tags: normalizedTags };
}

/**
 * Soft-delete multiple contracts at once.
 * Only admin/manager can perform this operation (enforced at route level).
 */
export async function bulkDelete(orgId, userId, { contractIds }) {
    if (!contractIds || contractIds.length === 0) {
        throw new AppError('At least one contract ID is required.', 400, 'INVALID_INPUT');
    }

    // Cap bulk delete to prevent accidents
    if (contractIds.length > 50) {
        throw new AppError('Cannot delete more than 50 contracts at once.', 400, 'LIMIT_EXCEEDED');
    }

    const result = await Contract.updateMany(
        { _id: { $in: contractIds }, orgId, isDeleted: false },
        { isDeleted: true, deletedAt: new Date(), deletedBy: userId }
    );

    logger.info({ orgId, userId, deletedCount: result.modifiedCount }, 'Bulk contracts deleted');

    await auditService.log({
        orgId,
        userId,
        action: 'contract.bulk_deleted',
        resourceType: 'Contract',
        metadata: { contractIds, deletedCount: result.modifiedCount },
    });

    return { deletedCount: result.modifiedCount };
}

/**
 * Update contract type for multiple contracts.
 */
export async function bulkUpdateType(orgId, userId, { contractIds, type }) {
    if (!contractIds || contractIds.length === 0) {
        throw new AppError('At least one contract ID is required.', 400, 'INVALID_INPUT');
    }

    const validTypes = ['NDA', 'Vendor', 'Employment', 'SaaS', 'Other'];
    if (!validTypes.includes(type)) {
        throw new AppError(`Invalid type. Must be one of: ${validTypes.join(', ')}`, 400, 'INVALID_INPUT');
    }

    const result = await Contract.updateMany(
        { _id: { $in: contractIds }, orgId, isDeleted: false },
        { $set: { type } }
    );

    logger.info({ orgId, userId, modifiedCount: result.modifiedCount, type }, 'Bulk type updated');

    await auditService.log({
        orgId,
        userId,
        action: 'contract.bulk_type_updated',
        resourceType: 'Contract',
        metadata: { contractIds, type, modifiedCount: result.modifiedCount },
    });

    return { modifiedCount: result.modifiedCount, type };
}
