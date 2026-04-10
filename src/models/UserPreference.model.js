/**
 * UserPreference Model
 *
 * Per-user settings for notification channels, display preferences,
 * and default behaviors. One document per user — upserted on first write.
 *
 * Separated from the User model to keep auth-critical fields lean
 * and avoid bloating the user document on every preference change.
 */

import mongoose from 'mongoose';

const userPreferenceSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true, // One preference document per user
        },
        // ─── Notification Preferences ──────────────────────────────
        notifications: {
            emailOnAnalysisComplete: { type: Boolean, default: true },
            emailOnContractExpiring: { type: Boolean, default: true },
            emailOnCommentAdded: { type: Boolean, default: true },
            emailOnInvitation: { type: Boolean, default: true },
            pushOnAnalysisComplete: { type: Boolean, default: true },
            pushOnContractExpiring: { type: Boolean, default: true },
            pushOnCommentAdded: { type: Boolean, default: true },
        },
        // ─── Display Preferences ───────────────────────────────────
        display: {
            contractsPerPage: { type: Number, default: 10, min: 5, max: 50 },
            defaultSortBy: {
                type: String,
                enum: ['createdAt', 'title', 'type', 'expiryDate', 'riskScore'],
                default: 'createdAt',
            },
            defaultSortOrder: {
                type: String,
                enum: ['asc', 'desc'],
                default: 'desc',
            },
            showRiskBadges: { type: Boolean, default: true },
        },
        // ─── Default Behaviors ─────────────────────────────────────
        defaults: {
            contractType: {
                type: String,
                enum: ['NDA', 'Vendor', 'Employment', 'SaaS', 'Other'],
                default: 'Other',
            },
            alertDays: {
                type: [Number],
                default: [90, 60, 30, 7],
            },
        },
        // ─── Timezone ──────────────────────────────────────────────
        timezone: {
            type: String,
            default: 'UTC',
            maxlength: 50,
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

const UserPreference = mongoose.model('UserPreference', userPreferenceSchema);

export default UserPreference;
