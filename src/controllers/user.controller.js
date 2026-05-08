/**
 * User Controller
 *
 * Profile management endpoints.
 * Email changes are NOT allowed here — they require a separate verification flow.
 * Password changes are handled by POST /api/v1/auth/change-password.
 */

import * as userService from '../services/user.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

/** GET /users/me — get the current user's profile with quota info */
export async function getProfile(req, res) {
    // req.user.userId is set by the authenticate middleware from the PASETO token
    const user = await userService.getUserProfile(req.user.userId);
    sendSuccess(res, { data: { user } });
}

/** PATCH /users/me — update profile (name only) */
export async function updateProfile(req, res) {
    // Service only allows 'name' — other fields are silently ignored
    const user = await userService.updateUserProfile(req.user.userId, req.body);
    sendSuccess(res, { message: 'Profile updated successfully', data: { user } });
}

/** GET /users/:id — get any user by ID (admin only, enforced by RBAC middleware) */
export async function getUserById(req, res) {
    const user = await userService.getUserById(req.params.id);
    sendSuccess(res, { data: { user } });
}

/** PATCH /users/:id/role — change a user's role (admin only, cannot change own role) */
export async function changeUserRole(req, res) {
    const user = await userService.changeUserRole(req.params.id, req.body.role, req.user.userId);
    sendSuccess(res, {
        message: `User role updated to '${req.body.role}' successfully.`,
        data: { userId: user._id, role: user.role },
    });
}
