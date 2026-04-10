/**
 * Comment Controller
 *
 * Thin HTTP layer for contract comment CRUD.
 * All business logic (ownership checks, org isolation) lives in comment.service.js.
 */

import * as commentService from '../services/comment.service.js';
import * as auditService from '../services/audit.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import HTTP from '../constants/httpStatus.js';

/** POST /contracts/:contractId/comments — add a comment */
export async function createComment(req, res) {
    const { orgId } = req;
    const comment = await commentService.createComment({
        orgId,
        contractId: req.params.contractId,
        userId: req.user.userId,
        content: req.body.content,
    });

    await auditService.log({
        orgId,
        userId: req.user.userId,
        action: 'comment.created',
        resourceType: 'Contract',
        resourceId: req.params.contractId,
        metadata: { commentId: comment._id },
        ipAddress: req.ip,
    });

    sendSuccess(res, { statusCode: HTTP.CREATED, message: 'Comment added.', data: { comment } });
}

/** GET /contracts/:contractId/comments — list comments with pagination */
export async function listComments(req, res) {
    const { orgId } = req;
    const { comments, meta } = await commentService.listComments(req.params.contractId, orgId, req.query);
    sendSuccess(res, { data: { comments, meta } });
}

/** PATCH /contracts/:contractId/comments/:commentId — edit a comment */
export async function updateComment(req, res) {
    const { orgId } = req;
    const comment = await commentService.updateComment(
        req.params.commentId,
        orgId,
        req.user.userId,
        req.body.content
    );
    sendSuccess(res, { message: 'Comment updated.', data: { comment } });
}

/** DELETE /contracts/:contractId/comments/:commentId — delete a comment */
export async function deleteComment(req, res) {
    const { orgId } = req;
    await commentService.deleteComment(
        req.params.commentId,
        orgId,
        req.user.userId,
        req.user.role
    );
    sendSuccess(res, { message: 'Comment deleted.' });
}
