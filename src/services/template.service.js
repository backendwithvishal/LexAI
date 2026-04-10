/**
 * Template Service
 *
 * CRUD operations for contract templates.
 * Supports both org-scoped and global (admin-created) templates.
 * Tracks usage count when templates are cloned into contracts.
 */

import Template from '../models/Template.model.js';
import { buildPaginationMeta } from '../utils/apiResponse.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

/**
 * Create a new contract template.
 */
export async function createTemplate({ orgId, userId, title, description, content, type, category, tags }) {
    const template = await Template.create({
        orgId,
        createdBy: userId,
        title,
        description,
        content,
        type: type || 'Other',
        category: category || 'General',
        tags: tags || [],
    });

    logger.info({ orgId, userId, templateId: template._id, title }, 'Template created');

    return template;
}

/**
 * List templates — org-scoped + global templates.
 * Supports filtering by type and category, with pagination.
 */
export async function listTemplates(orgId, query = {}) {
    const { page = 1, limit = 20, type, category, search } = query;
    const skip = (page - 1) * limit;

    // Show both org templates and global templates
    const filter = {
        $or: [{ orgId }, { isGlobal: true }],
        isActive: true,
    };

    if (type) filter.type = type;
    if (category) filter.category = category;
    if (search) {
        filter.$or = [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
        ];
        // Override the org/global $or — combine with $and
        delete filter.$or;
        filter.$and = [
            { $or: [{ orgId }, { isGlobal: true }] },
            { $or: [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ]},
        ];
    }

    const [templates, total] = await Promise.all([
        Template.find(filter)
            .select('-content') // Exclude content from list view
            .sort({ usageCount: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Template.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(total, page, limit);

    return { templates, meta };
}

/**
 * Get a single template by ID with full content.
 */
export async function getTemplate(templateId, orgId) {
    const template = await Template.findOne({
        _id: templateId,
        $or: [{ orgId }, { isGlobal: true }],
        isActive: true,
    }).lean();

    if (!template) {
        throw new AppError('Template not found.', 404, 'NOT_FOUND');
    }

    return template;
}

/**
 * Update a template — only org templates, not global ones.
 */
export async function updateTemplate(templateId, orgId, updates) {
    const allowedFields = ['title', 'description', 'content', 'type', 'category', 'tags'];
    const sanitized = {};
    for (const field of allowedFields) {
        if (updates[field] !== undefined) sanitized[field] = updates[field];
    }

    const template = await Template.findOneAndUpdate(
        { _id: templateId, orgId, isActive: true },
        { $set: sanitized },
        { new: true, runValidators: true }
    );

    if (!template) {
        throw new AppError('Template not found or you do not have permission to edit it.', 404, 'NOT_FOUND');
    }

    return template;
}

/**
 * Soft-delete a template by setting isActive to false.
 */
export async function deleteTemplate(templateId, orgId) {
    const template = await Template.findOneAndUpdate(
        { _id: templateId, orgId, isActive: true },
        { isActive: false },
        { new: true }
    );

    if (!template) {
        throw new AppError('Template not found or you do not have permission to delete it.', 404, 'NOT_FOUND');
    }

    logger.info({ orgId, templateId }, 'Template deleted');

    return template;
}

/**
 * Increment usage count when a template is cloned into a contract.
 */
export async function incrementUsage(templateId) {
    await Template.findByIdAndUpdate(templateId, { $inc: { usageCount: 1 } });
}
