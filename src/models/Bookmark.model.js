/**
 * Bookmark Model
 *
 * Lightweight document linking a user to a favorited contract.
 * Uses a unique compound index to prevent duplicate bookmarks.
 *
 * No soft delete — bookmarks are hard-deleted since they carry
 * no audit significance.
 */

import mongoose from 'mongoose';

const bookmarkSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        contractId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Contract',
            required: true,
        },
        orgId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
        },
        note: {
            type: String,
            trim: true,
            maxlength: 500, // Optional short note about why it was bookmarked
        },
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
// Unique compound — a user can bookmark each contract only once
bookmarkSchema.index({ userId: 1, contractId: 1 }, { unique: true });
bookmarkSchema.index({ userId: 1, createdAt: -1 });  // User's bookmark feed (newest first)
bookmarkSchema.index({ orgId: 1 });                    // Org-scoped cleanup

const Bookmark = mongoose.model('Bookmark', bookmarkSchema);

export default Bookmark;
