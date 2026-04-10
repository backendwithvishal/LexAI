/**
 * Tag Controller
 *
 * Thin HTTP layer for tag management operations.
 */

import * as tagService from '../services/tag.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

/** GET /tags — list all unique tags with usage counts */
export async function listTags(req, res) {
    const { orgId } = req;
    const tags = await tagService.listTags(orgId);
    sendSuccess(res, { data: { tags } });
}

/** PATCH /tags/rename — rename a tag across all contracts */
export async function renameTag(req, res) {
    const { orgId } = req;
    const { oldTag, newTag } = req.body;
    const result = await tagService.renameTag(orgId, oldTag, newTag);
    sendSuccess(res, { message: `Tag "${result.oldTag}" renamed to "${result.newTag}".`, data: result });
}

/** DELETE /tags/:tag — remove a tag from all contracts */
export async function deleteTag(req, res) {
    const { orgId } = req;
    const result = await tagService.deleteTag(orgId, req.params.tag);
    sendSuccess(res, { message: `Tag "${result.tag}" removed from ${result.contractsAffected} contracts.`, data: result });
}
