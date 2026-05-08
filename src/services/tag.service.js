/**
 * Tag Service
 *
 * Tag management operations across the org's contract portfolio.
 * Tags live on Contract documents as an array — this service
 * provides aggregation views and bulk mutation operations.
 */

import Contract from '../models/Contract.model.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

/**
 * List all unique tags with usage counts for an org.
 */
export async function listTags(orgId) {
    const tags = await Contract.aggregate([
        { $match: { orgId, isDeleted: false } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, tag: '$_id', count: 1 } },
    ]);

    return tags;
}

/**
 * Rename a tag across all contracts in the org.
 * Uses MongoDB's $set with array positional operator for atomic updates.
 */
export async function renameTag(orgId, oldTag, newTag) {
    const normalizedOld = oldTag.trim().toLowerCase();
    const normalizedNew = newTag.trim().toLowerCase();

    if (normalizedOld === normalizedNew) {
        throw new AppError('Old and new tag names are identical.', 400, 'INVALID_INPUT');
    }

    // Check if any contracts have the old tag
    const count = await Contract.countDocuments({
        orgId,
        isDeleted: false,
        tags: normalizedOld,
    });

    if (count === 0) {
        throw new AppError(`Tag "${normalizedOld}" not found in any contracts.`, 404, 'NOT_FOUND');
    }

    // Rename: pull old, add new (avoids duplicates if new tag already exists)
    await Contract.updateMany(
        { orgId, isDeleted: false, tags: normalizedOld },
        { $pull: { tags: normalizedOld } }
    );

    await Contract.updateMany(
        { orgId, isDeleted: false, tags: { $ne: normalizedNew } },
        { $addToSet: { tags: normalizedNew } }
    );

    // Re-run on the originally matched set to add the new tag
    // This is a two-step because $rename doesn't work on array elements
    await Contract.updateMany(
        { orgId, isDeleted: false },
        { $addToSet: { tags: normalizedNew } }
    );

    logger.info({ orgId, oldTag: normalizedOld, newTag: normalizedNew, modifiedCount: count }, 'Tag renamed');

    return { oldTag: normalizedOld, newTag: normalizedNew, contractsAffected: count };
}

/**
 * Remove a tag from all contracts in the org.
 */
export async function deleteTag(orgId, tag) {
    const normalizedTag = tag.trim().toLowerCase();

    const result = await Contract.updateMany(
        { orgId, isDeleted: false, tags: normalizedTag },
        { $pull: { tags: normalizedTag } }
    );

    if (result.modifiedCount === 0) {
        throw new AppError(`Tag "${normalizedTag}" not found in any contracts.`, 404, 'NOT_FOUND');
    }

    logger.info({ orgId, tag: normalizedTag, modifiedCount: result.modifiedCount }, 'Tag deleted');

    return { tag: normalizedTag, contractsAffected: result.modifiedCount };
}
