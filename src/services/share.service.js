/**
 * Share Service
 *
 * Creates and manages secure share links for contracts.
 *
 * Security considerations:
 *   - Tokens are 64-char crypto-random hex strings
 *   - Links auto-expire via MongoDB TTL index
 *   - Access is logged (count + timestamp) for auditing
 *   - Optional password protection via bcrypt
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import ShareLink from '../models/ShareLink.model.js';
import Contract from '../models/Contract.model.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

const DEFAULT_EXPIRY_HOURS = 72; // 3 days
const SALT_ROUNDS = 10;

/**
 * Create a new share link for a contract.
 */
export async function createShareLink({ orgId, contractId, userId, permissions, expiryHours, password, note }) {
    // Verify the contract exists
    const contract = await Contract.findOne({ _id: contractId, orgId, isDeleted: false });
    if (!contract) {
        throw new AppError('Contract not found.', 404, 'NOT_FOUND');
    }

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex');

    const hours = expiryHours || DEFAULT_EXPIRY_HOURS;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    // Hash password if provided
    let hashedPassword = undefined;
    if (password) {
        hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    }

    const shareLink = await ShareLink.create({
        orgId,
        contractId,
        createdBy: userId,
        token,
        permissions: permissions || 'view_metadata',
        expiresAt,
        password: hashedPassword,
        note,
    });

    logger.info({ orgId, contractId, userId, shareLinkId: shareLink._id, expiresAt }, 'Share link created');

    return {
        id: shareLink._id,
        token: shareLink.token,
        permissions: shareLink.permissions,
        expiresAt: shareLink.expiresAt,
        hasPassword: !!password,
        note: shareLink.note,
    };
}

/**
 * List share links for a contract.
 */
export async function listShareLinks(contractId, orgId) {
    const links = await ShareLink.find({ contractId, orgId })
        .select('-password')
        .sort({ createdAt: -1 })
        .populate('createdBy', 'name email')
        .lean();

    return links;
}

/**
 * Revoke (deactivate) a share link.
 */
export async function revokeShareLink(shareLinkId, orgId) {
    const link = await ShareLink.findOneAndUpdate(
        { _id: shareLinkId, orgId, isActive: true },
        { isActive: false },
        { new: true }
    );

    if (!link) {
        throw new AppError('Share link not found.', 404, 'NOT_FOUND');
    }

    logger.info({ orgId, shareLinkId }, 'Share link revoked');

    return link;
}

