/**
 * Comment Service
 *
 * CRUD operations for contract comments.
 * Enforces org isolation and ownership checks.
 * Supports soft delete to preserve thread context.
 */

import Comment from '../models/Comment.model.js';
import Contract from '../models/Contract.model.js';
import { buildPaginationMeta } from '../utils/apiResponse.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

/**
 * Add a comment to a contract.
 */
export async function createComment({ orgId, contractId, userId, content }) {
    // Verify the contract exists and belongs to this org
    const contract = await Contract.findOne({ _id: contractId, orgId, isDeleted: false });
    if (!contract) {
        throw new AppError('Contract not found.', 404, 'NOT_FOUND');
    }

    const comment = await Comment.create({ orgId, contractId, userId, content });

    logger.info({ orgId, contractId, userId, commentId: comment._id }, 'Comment added');

    return comment;
}

/**
 * List comments for a contract with pagination.
 */
export async function listComments(contractId, orgId, query = {}) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const filter = { contractId, orgId, isDeleted: false };

    const [comments, total] = await Promise.all([
        Comment.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', 'name email')
            .lean(),
        Comment.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(total, page, limit);

    return { comments, meta };
}

/**
 * Update a comment — only the author can edit their own comment.
 */
export async function updateComment(commentId, orgId, userId, content) {
    const comment = await Comment.findOne({ _id: commentId, orgId, isDeleted: false });

    if (!comment) {
        throw new AppError('Comment not found.', 404, 'NOT_FOUND');
    }

    // Only the author can edit their own comment
    if (comment.userId.toString() !== userId.toString()) {
        throw new AppError('You can only edit your own comments.', 403, 'FORBIDDEN');
    }

    comment.content = content;
    comment.isEdited = true;
    await comment.save();

    return comment;
}

/**
 * Soft delete a comment.
 * Authors can delete their own. Admins can delete any comment.
 */
export async function deleteComment(commentId, orgId, userId, userRole) {
    const comment = await Comment.findOne({ _id: commentId, orgId, isDeleted: false });

    if (!comment) {
        throw new AppError('Comment not found.', 404, 'NOT_FOUND');
    }

    // Admins can delete any comment; others can only delete their own
    const isOwner = comment.userId.toString() === userId.toString();
    const isAdmin = userRole === 'admin';

    if (!isOwner && !isAdmin) {
        throw new AppError('You can only delete your own comments.', 403, 'FORBIDDEN');
    }

    comment.isDeleted = true;
    comment.deletedAt = new Date();
    await comment.save();

    logger.info({ orgId, commentId, userId }, 'Comment deleted');

    return comment;
}
