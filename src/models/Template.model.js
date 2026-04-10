/**
 * Template Model
 *
 * Reusable contract templates that org members can use to quickly
 * create new contracts with pre-filled structure and boilerplate text.
 *
 * Templates can be:
 *   - Org-scoped (custom templates created by the team)
 *   - Shared across the platform (isGlobal: true, admin-created)
 *
 * Key design decisions:
 *   - Content stores the template body text with placeholders like {{PARTY_NAME}}
 *   - category field allows grouping templates in the UI
 *   - usageCount tracks popularity for sorting/recommendation
 */

import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema(
    {
        orgId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            // Not required — global templates have no org
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        title: {
            type: String,
            required: [true, 'Template title is required'],
            trim: true,
            maxlength: 300,
        },
        description: {
            type: String,
            trim: true,
            maxlength: 1000,
        },
        content: {
            type: String,
            required: [true, 'Template content is required'],
            maxlength: 500_000,
        },
        type: {
            type: String,
            enum: ['NDA', 'Vendor', 'Employment', 'SaaS', 'Other'],
            default: 'Other',
        },
        category: {
            type: String,
            trim: true,
            maxlength: 100,
            default: 'General',
        },
        tags: [{ type: String, trim: true, lowercase: true }],
        // Global templates are visible to all orgs (admin-created)
        isGlobal: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },
        usageCount: { type: Number, default: 0 },
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
templateSchema.index({ orgId: 1, isActive: 1 });           // Org template listing
templateSchema.index({ isGlobal: 1, isActive: 1 });        // Global template listing
templateSchema.index({ type: 1 });                           // Filter by contract type
templateSchema.index({ usageCount: -1 });                    // Sort by popularity

const Template = mongoose.model('Template', templateSchema);

export default Template;
