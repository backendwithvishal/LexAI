/**
 * User Service
 *
 * Business logic for user profile operations:
 *   - Get profile with quota info
 *   - Update profile (name only — email changes require verification)
 *   - Admin user lookup
 *
 * Password changes are handled by auth.service.js (POST /auth/change-password).
 */

import User from '../models/User.model.js';
import Organization from '../models/Organization.model.js';
import { getRedisClient } from '../config/redis.js';
import { REDIS_KEYS } from '../constants/redisKeys.js';
import { getCurrentMonthKey, getQuotaResetDate } from '../utils/dateHelper.js';
import { getPlanLimits } from '../constants/plans.js';
import AppError from '../utils/AppError.js';

/**
 * Get the current user's profile with quota information.
 */
export async function getUserProfile(userId) {
    const user = await User.findById(userId)
        .populate('organization', 'name plan')
        .lean();

    if (!user) {
        throw new AppError('User not found.', 404, 'NOT_FOUND');
    }

    const quota = await getUserQuota(userId, user.organization?.plan);

    return { ...user, id: user._id, quota };
}

/**
 * Update the current user's profile.
 * Only 'name' is allowed — prevents changing email/role via this endpoint.
 */
export async function updateUserProfile(userId, updates) {
    const allowedFields = ['name'];
    const sanitized = {};
    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            sanitized[field] = updates[field];
        }
    }

    const user = await User.findByIdAndUpdate(userId, sanitized, {
        new: true,
        runValidators: true,
    });

    if (!user) {
        throw new AppError('User not found.', 404, 'NOT_FOUND');
    }

    return user;
}

/**
 * Get user's monthly quota usage from Redis.
 */
async function getUserQuota(userId, plan) {
    const redis = getRedisClient();
    const monthKey = getCurrentMonthKey();
    const quotaKey = `quota:${userId}:${monthKey}`;
    const planLimits = getPlanLimits(plan || 'free');

    const used = parseInt(await redis.get(quotaKey)) || 0;
    const limit = planLimits.analysesPerMonth === Infinity ? 'unlimited' : planLimits.analysesPerMonth;

    return {
        used,
        limit,
        remaining: limit === 'unlimited' ? 'unlimited' : Math.max(0, limit - used),
        resetsAt: getQuotaResetDate(),
    };
}

/**
 * Get user by ID (admin use).
 */
export async function getUserById(userId) {
    const user = await User.findById(userId).populate('organization', 'name plan').lean();
    if (!user) {
        throw new AppError('User not found.', 404, 'NOT_FOUND');
    }
    return user;
}

/**
 * Change a user's role (admin only).
 *
 * Keeps the User document, the org's members array, and the Redis role
 * cache all in sync — same pattern as org.service.changeMemberRole.
 *
 * @param {string} targetUserId  - ID of the user whose role is being changed
 * @param {string} newRole       - The new role to assign
 * @param {string} requesterId   - ID of the admin making the request
 */
export async function changeUserRole(targetUserId, newRole, requesterId) {
    // Prevent admins from changing their own role
    if (requesterId.toString() === targetUserId.toString()) {
        throw new AppError('You cannot change your own role.', 400, 'SELF_ROLE_CHANGE');
    }

    const target = await User.findById(targetUserId);
    if (!target) {
        throw new AppError('User not found.', 404, 'NOT_FOUND');
    }

    // Update the role on the User document
    target.role = newRole;
    await target.save();

    // Keep the org's members array in sync if the user belongs to an org
    if (target.organization) {
        await Organization.updateOne(
            { _id: target.organization, 'members.userId': targetUserId },
            { $set: { 'members.$.role': newRole } }
        );
    }

    // Invalidate the Redis role cache so the change takes effect immediately
    const redis = getRedisClient();
    await redis.del(REDIS_KEYS.userRole(targetUserId.toString()));

    return target;
}
