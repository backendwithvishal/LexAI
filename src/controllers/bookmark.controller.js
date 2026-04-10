/**
 * Bookmark Controller
 *
 * Thin HTTP layer for contract bookmark operations.
 */

import * as bookmarkService from '../services/bookmark.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import HTTP from '../constants/httpStatus.js';

/** POST /bookmarks — bookmark a contract */
export async function createBookmark(req, res) {
    const bookmark = await bookmarkService.createBookmark({
        userId: req.user.userId,
        contractId: req.body.contractId,
        orgId: req.orgId,
        note: req.body.note,
    });
    sendSuccess(res, { statusCode: HTTP.CREATED, message: 'Contract bookmarked.', data: { bookmark } });
}

/** GET /bookmarks — list bookmarked contracts */
export async function listBookmarks(req, res) {
    const { bookmarks, meta } = await bookmarkService.listBookmarks(req.user.userId, req.orgId, req.query);
    sendSuccess(res, { data: { bookmarks, meta } });
}

/** DELETE /bookmarks/:contractId — remove a bookmark */
export async function deleteBookmark(req, res) {
    await bookmarkService.deleteBookmark(req.user.userId, req.params.contractId, req.orgId);
    sendSuccess(res, { message: 'Bookmark removed.' });
}
