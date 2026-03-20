/**
 * Contract Controller
 *
 * Thin HTTP layer for contract CRUD, versioning, search, and audit trail.
 * All business logic (plan limits, text extraction, dedup) lives in contract.service.js.
 * req.orgId is set by the requireOrg middleware — never trust client-supplied org IDs.
 */

import * as contractService from '../services/contract.service.js';
import * as auditService from '../services/audit.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import HTTP from '../constants/httpStatus.js';

/** POST /contracts — supports file upload (multer) or raw text body */
export async function uploadContract(req, res) {
    const { orgId } = req;

    // Tags can arrive as a JSON array string from multipart forms — try to parse it
    let tags = req.body.tags;
    if (typeof tags === 'string') {
        try { tags = JSON.parse(tags); } catch { /* leave as string — service handles it */ }
    }

    const contract = await contractService.createContract({
        orgId,
        userId: req.user.userId,
        title: req.body.title,
        type: req.body.type,
        tags,
        content: req.body.content,  // raw text (optional if file is provided)
        file: req.file,             // multer file object (optional if content is provided)
    });

    // Return only the lightweight summary — not the full content
    sendSuccess(res, {
        statusCode: HTTP.CREATED,
        message: 'Contract uploaded successfully',
        data: {
            contract: {
                id: contract._id,
                title: contract.title,
                type: contract.type,
                version: contract.currentVersion,
                contentHash: contract.contentHash,
            },
        },
    });
}

/** GET /contracts — list with pagination, filtering, and full-text search */
export async function listContracts(req, res) {
    const { orgId } = req;
    // req.query is validated + sanitized by the validate middleware before reaching here
    const { contracts, meta } = await contractService.listContracts(orgId, req.query);
    sendSuccess(res, { data: { contracts, meta } });
}

/** GET /contracts/:id — get full contract details including content */
export async function getContract(req, res) {
    const { orgId } = req;
    const contract = await contractService.getContractById(req.params.id, orgId);
    sendSuccess(res, { data: { contract } });
}

/** PATCH /contracts/:id — update metadata only (title, tags, alertDays) */
export async function updateContract(req, res) {
    const { orgId } = req;
    // Service only allows safe fields — content changes go through addVersion
    const contract = await contractService.updateContract(req.params.id, orgId, req.body);
    sendSuccess(res, { data: { contract } });
}

/** POST /contracts/:id/versions — upload a new version of an existing contract */
export async function uploadVersion(req, res) {
    const { orgId } = req;
    const result = await contractService.addVersion(req.params.id, orgId, req.user.userId, req.body);
    sendSuccess(res, { statusCode: HTTP.CREATED, data: result });
}

/** GET /contracts/:id/versions — list version history (metadata only, no content) */
export async function getVersions(req, res) {
    const { orgId } = req;
    const versions = await contractService.getVersions(req.params.id, orgId);
    sendSuccess(res, { data: { versions } });
}

/** DELETE /contracts/:id — soft delete (preserves audit trail) */
export async function deleteContract(req, res) {
    const { orgId } = req;
    // Soft delete sets isDeleted=true — the document is never actually removed from MongoDB
    await contractService.deleteContract(req.params.id, orgId, req.user.userId);
    sendSuccess(res, { message: 'Contract deleted successfully.' });
}

/** GET /contracts/:id/audit — get audit trail for a specific contract */
export async function getContractAudit(req, res) {
    const { orgId } = req;
    const logs = await auditService.getContractAuditLogs(req.params.id, orgId);
    sendSuccess(res, { data: { logs } });
}
