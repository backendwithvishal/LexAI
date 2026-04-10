/**
 * Preference Controller
 *
 * Thin HTTP layer for user preference management.
 */

import * as preferenceService from '../services/preference.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

/** GET /preferences — get current user's preferences */
export async function getPreferences(req, res) {
    const preferences = await preferenceService.getPreferences(req.user.userId);
    sendSuccess(res, { data: { preferences } });
}

/** PUT /preferences — update current user's preferences */
export async function updatePreferences(req, res) {
    const preferences = await preferenceService.updatePreferences(req.user.userId, req.body);
    sendSuccess(res, { message: 'Preferences updated.', data: { preferences } });
}

/** DELETE /preferences — reset preferences to defaults */
export async function resetPreferences(req, res) {
    const preferences = await preferenceService.resetPreferences(req.user.userId);
    sendSuccess(res, { message: 'Preferences reset to defaults.', data: { preferences } });
}
