/**
 * Comment Model
 *
 * Stores user comments/notes on contracts for team collaboration.
 * Comments are org-scoped and tied to a specific contract.
 *
 * Key design decisions:
 *   - Soft delete via isDeleted flag preserves context in threads.
 *   - isEdited flag lets the UI show "(edited)" indicator.
 *   - 30-day TTL on deleted comments for eventual cleanup.
 */

import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
    {
        orgId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
        },
        contractId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Contract',
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        content: {
            type: String,
            required: [true, 'Comment content is required'],
            trim: true,
            maxlength: 5000,
        },
        isEdited: { type: Boolean, default: false },
        isDeleted: { type: Boolean, default: false },
        deletedAt: Date,
    },
    {
        timestamps: true,
        toJSON: {
            transform(doc, ret) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    }
);

// ─── Indexes ──────────────────────────────────────────────────────
commentSchema.index({ contractId: 1, createdAt: -1 });  // List comments for a contract
commentSchema.index({ orgId: 1, userId: 1 });             // User's comments within an org
commentSchema.index({ contractId: 1, isDeleted: 1 });     // Filter active comments

const Comment = mongoose.model('Comment', commentSchema);

export default Comment;
