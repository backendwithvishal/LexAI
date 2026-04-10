/**
 * Bookmark Service
 *
 * CRUD operations for user contract bookmarks.
 * Bookmarks are user-scoped but org-isolated.
 */

import Bookmark from '../models/Bookmark.model.js';
import Contract from '../models/Contract.model.js';
import { buildPaginationMeta } from '../utils/apiResponse.js';
import AppError from '../utils/AppError.js';

/**
 * Add a bookmark for a contract.
 * Throws CONFLICT if already bookmarked.
 */
export async function createBookmark({ userId, contractId, orgId, note }) {
    // Verify contract exists and belongs to the org
    const contract = await Contract.findOne({ _id: contractId, orgId, isDeleted: false });
    if (!contract) {
        throw new AppError('Contract not found.', 404, 'NOT_FOUND');
    }

    // Check for existing bookmark (unique index will also catch this, but gives a better error)
    const existing = await Bookmark.findOne({ userId, contractId });
    if (existing) {
        throw new AppError('Contract is already bookmarked.', 409, 'ALREADY_BOOKMARKED');
    }

    const bookmark = await Bookmark.create({ userId, contractId, orgId, note });
    return bookmark;
}

/**
 * List the user's bookmarked contracts with pagination.
 * Populates contract metadata for the listing view.
 */
export async function listBookmarks(userId, orgId, query = {}) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const filter = { userId, orgId };

    const [bookmarks, total] = await Promise.all([
        Bookmark.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate({
                path: 'contractId',
                select: 'title type tags expiryDate currentVersion createdAt',
                match: { isDeleted: false },
            })
            .lean(),
        Bookmark.countDocuments(filter),
    ]);

    // Filter out bookmarks where the contract was deleted (populate returns null)
    const activeBookmarks = bookmarks.filter((b) => b.contractId !== null);

    const meta = buildPaginationMeta(total, page, limit);

    return { bookmarks: activeBookmarks, meta };
}

/**
 * Remove a bookmark by contractId.
 */
export async function deleteBookmark(userId, contractId, orgId) {
    const result = await Bookmark.findOneAndDelete({ userId, contractId, orgId });

    if (!result) {
        throw new AppError('Bookmark not found.', 404, 'NOT_FOUND');
    }

    return result;
}
