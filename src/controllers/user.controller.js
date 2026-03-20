/**
 * User Controller
 *
 * Profile management endpoints.
 * Email changes are NOT allowed here — they require a separate verification flow.
 * Password changes are handled by auth.controller.js (requires current password).
 */

import * as userService from '../services/user.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

/** GET /users/me — get the current user's profile with quota info */
export async function getProfile(req, res) {
    // req.user.userId is set by the authenticate middleware from the JWT
    const user = await userService.getUserProfile(req.user.userId);
    sendSuccess(res, { data: { user } });
}

/** PATCH /users/me — update profile (name only) */
export async function updateProfile(req, res) {
    // Service only allows 'name' — other fields are silently ignored
    const user = await userService.updateUserProfile(req.user.userId, req.body);
    sendSuccess(res, { message: 'Profile updated successfully', data: { user } });
}

/** PATCH /users/me/password — change password (requires current password) */
export async function changePassword(req, res) {
    await userService.changePassword(req.user.userId, req.body.currentPassword, req.body.newPassword);
    sendSuccess(res, { message: 'Password changed successfully.' });
}

/** GET /users/:id — get any user by ID (admin only, enforced by RBAC middleware) */
export async function getUserById(req, res) {
    const user = await userService.getUserById(req.params.id);
    sendSuccess(res, { data: { user } });
}
