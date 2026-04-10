/**
 * Template Controller
 *
 * Thin HTTP layer for contract template CRUD and cloning.
 * All business logic lives in template.service.js.
 */

import * as templateService from '../services/template.service.js';
import * as contractService from '../services/contract.service.js';
import * as auditService from '../services/audit.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import HTTP from '../constants/httpStatus.js';

/** POST /templates — create a new template */
export async function createTemplate(req, res) {
    const { orgId } = req;
    const template = await templateService.createTemplate({
        orgId,
        userId: req.user.userId,
        ...req.body,
    });

    await auditService.log({
        orgId,
        userId: req.user.userId,
        action: 'template.created',
        resourceType: 'Contract',
        resourceId: template._id,
        metadata: { title: template.title },
        ipAddress: req.ip,
    });

    sendSuccess(res, { statusCode: HTTP.CREATED, message: 'Template created.', data: { template } });
}

/** GET /templates — list templates (org + global) */
export async function listTemplates(req, res) {
    const { orgId } = req;
    const { templates, meta } = await templateService.listTemplates(orgId, req.query);
    sendSuccess(res, { data: { templates, meta } });
}

/** GET /templates/:id — get full template details */
export async function getTemplate(req, res) {
    const { orgId } = req;
    const template = await templateService.getTemplate(req.params.id, orgId);
    sendSuccess(res, { data: { template } });
}

/** PATCH /templates/:id — update a template */
export async function updateTemplate(req, res) {
    const { orgId } = req;
    const template = await templateService.updateTemplate(req.params.id, orgId, req.body);
    sendSuccess(res, { message: 'Template updated.', data: { template } });
}

/** DELETE /templates/:id — soft-delete a template */
export async function deleteTemplate(req, res) {
    const { orgId } = req;
    await templateService.deleteTemplate(req.params.id, orgId);
    sendSuccess(res, { message: 'Template deleted.' });
}

/** POST /templates/:id/clone — create a contract from a template */
export async function cloneTemplate(req, res) {
    const { orgId } = req;
    const template = await templateService.getTemplate(req.params.id, orgId);

    // Create contract from template content
    const contract = await contractService.createContract({
        orgId,
        userId: req.user.userId,
        title: req.body.title || `${template.title} (from template)`,
        type: template.type,
        tags: template.tags,
        content: template.content,
    });

    // Track template usage
    await templateService.incrementUsage(req.params.id);

    await auditService.log({
        orgId,
        userId: req.user.userId,
        action: 'template.cloned',
        resourceType: 'Contract',
        resourceId: contract._id,
        metadata: { templateId: req.params.id, templateTitle: template.title },
        ipAddress: req.ip,
    });

    sendSuccess(res, {
        statusCode: HTTP.CREATED,
        message: 'Contract created from template.',
        data: {
            contract: {
                id: contract._id,
                title: contract.title,
                type: contract.type,
            },
        },
    });
}
