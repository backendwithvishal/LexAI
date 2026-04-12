/**
 * Share Controller
 *
 * Thin HTTP layer for contract sharing.
 */

import * as shareService from '../services/share.service.js';
import * as auditService from '../services/audit.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import HTTP from '../constants/httpStatus.js';

/** POST /shares — create a share link for a contract */
export async function createShareLink(req, res) {
    const { orgId } = req;
    const result = await shareService.createShareLink({
        orgId,
        contractId: req.body.contractId,
        userId: req.user.userId,
        permissions: req.body.permissions,
        expiryHours: req.body.expiryHours,
        password: req.body.password,
        note: req.body.note,
    });

    await auditService.log({
        orgId,
        userId: req.user.userId,
        action: 'share.created',
        resourceType: 'Contract',
        resourceId: req.body.contractId,
        metadata: { shareLinkId: result.id, permissions: result.permissions, expiresAt: result.expiresAt },
        ipAddress: req.ip,
    });

    sendSuccess(res, { statusCode: HTTP.CREATED, message: 'Share link created.', data: { shareLink: result } });
}

/** GET /shares/contract/:contractId — list share links for a contract */
export async function listShareLinks(req, res) {
    const { orgId } = req;
    const links = await shareService.listShareLinks(req.params.contractId, orgId);
    sendSuccess(res, { data: { shareLinks: links } });
}

/** DELETE /shares/:id — revoke a share link */
export async function revokeShareLink(req, res) {
    const { orgId } = req;
    await shareService.revokeShareLink(req.params.id, orgId);

    await auditService.log({
        orgId,
        userId: req.user.userId,
        action: 'share.revoked',
        resourceType: 'Contract',
        resourceId: req.params.id,
        ipAddress: req.ip,
    });

    sendSuccess(res, { message: 'Share link revoked.' });
}

