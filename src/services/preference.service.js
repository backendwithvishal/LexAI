/**
 * Preference Service
 *
 * Per-user preference management.
 * Uses upsert pattern — creates the preference document on first write.
 */

import UserPreference from '../models/UserPreference.model.js';

/**
 * Get preferences for a user. Returns defaults if none are saved.
 */
export async function getPreferences(userId) {
    let preferences = await UserPreference.findOne({ userId }).lean();

    // Return default preferences if none exist yet
    if (!preferences) {
        preferences = getDefaults(userId);
    }

    return preferences;
}

/**
 * Update preferences for a user. Upserts if not present.
 */
export async function updatePreferences(userId, updates) {
    // Flatten nested updates for MongoDB $set
    const setFields = {};

    if (updates.notifications) {
        for (const [key, value] of Object.entries(updates.notifications)) {
            setFields[`notifications.${key}`] = value;
        }
    }

    if (updates.display) {
        for (const [key, value] of Object.entries(updates.display)) {
            setFields[`display.${key}`] = value;
        }
    }

    if (updates.defaults) {
        for (const [key, value] of Object.entries(updates.defaults)) {
            setFields[`defaults.${key}`] = value;
        }
    }

    if (updates.timezone !== undefined) {
        setFields.timezone = updates.timezone;
    }

    const preferences = await UserPreference.findOneAndUpdate(
        { userId },
        { $set: setFields },
        { new: true, upsert: true, runValidators: true }
    );

    return preferences;
}

/**
 * Reset preferences to defaults.
 */
export async function resetPreferences(userId) {
    await UserPreference.findOneAndDelete({ userId });
    return getDefaults(userId);
}

/**
 * Default preferences — returned when no document exists.
 */
function getDefaults(userId) {
    return {
        userId,
        notifications: {
            emailOnAnalysisComplete: true,
            emailOnContractExpiring: true,
            emailOnCommentAdded: true,
            emailOnInvitation: true,
            pushOnAnalysisComplete: true,
            pushOnContractExpiring: true,
            pushOnCommentAdded: true,
        },
        display: {
            contractsPerPage: 10,
            defaultSortBy: 'createdAt',
            defaultSortOrder: 'desc',
            showRiskBadges: true,
        },
        defaults: {
            contractType: 'Other',
            alertDays: [90, 60, 30, 7],
        },
        timezone: 'UTC',
    };
}
