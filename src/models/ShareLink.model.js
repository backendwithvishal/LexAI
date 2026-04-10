/**
 * ShareLink Model
 *
 * Secure, time-limited sharing links for contracts.
 * Allows org members to share contract data with external parties
 * (e.g., outside counsel, auditors) without requiring them to
 * create an account.
 *
 * Security design:
 *   - Token is a crypto-random hex string (not guessable)
 *   - TTL index auto-deletes expired links
 *   - accessCount tracks usage for auditing
 *   - password field allows optional password protection
 */

import mongoose from 'mongoose';

const shareLinkSchema = new mongoose.Schema(
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
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        token: {
            type: String,
            required: true,
            unique: true,
        },
        // What the external viewer can see
        permissions: {
            type: String,
            enum: ['view_metadata', 'view_content', 'view_analysis'],
            default: 'view_metadata',
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        isActive: { type: Boolean, default: true },
        accessCount: { type: Number, default: 0 },
        lastAccessedAt: Date,
        // Optional password protection
        password: {
            type: String,
            select: false, // Never returned in queries unless explicitly selected
        },
        note: {
            type: String,
            trim: true,
            maxlength: 500, // Internal note about who this link was shared with
        },
    },
    {
        timestamps: true,
        toJSON: {
            transform(doc, ret) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                delete ret.password;
                return ret;
            },
        },
    }
);

// ─── Indexes ──────────────────────────────────────────────────────
shareLinkSchema.index({ contractId: 1 });                    // List links for a contract
shareLinkSchema.index({ orgId: 1, createdAt: -1 });          // Org-scoped link management

// TTL index — auto-delete expired share links
shareLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ShareLink = mongoose.model('ShareLink', shareLinkSchema);

export default ShareLink;
