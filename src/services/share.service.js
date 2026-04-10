/**
 * Share Service
 *
 * Creates and manages secure share links for contracts.
 * External parties can view shared contract data via a
 * unique token without needing an account.
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
import Analysis from '../models/Analysis.model.js';
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

/**
 * Access a shared contract via token (public endpoint — no auth required).
 * Returns contract data based on the link's permission level.
 */
export async function accessSharedContract(token, password) {
    const link = await ShareLink.findOne({ token, isActive: true }).select('+password');

    if (!link) {
        throw new AppError('Share link not found or has expired.', 404, 'NOT_FOUND');
    }

    // Check if link has expired (TTL might not have cleaned it up yet)
    if (link.expiresAt < new Date()) {
        throw new AppError('This share link has expired.', 410, 'LINK_EXPIRED');
    }

    // Verify password if required
    if (link.password) {
        if (!password) {
            throw new AppError('This share link requires a password.', 401, 'PASSWORD_REQUIRED');
        }
        const isValid = await bcrypt.compare(password, link.password);
        if (!isValid) {
            throw new AppError('Invalid password.', 401, 'INVALID_PASSWORD');
        }
    }

    // Increment access count
    await ShareLink.findByIdAndUpdate(link._id, {
        $inc: { accessCount: 1 },
        lastAccessedAt: new Date(),
    });

    // Fetch contract data based on permission level
    const contract = await Contract.findOne({
        _id: link.contractId,
        isDeleted: false,
    }).lean();

    if (!contract) {
        throw new AppError('The shared contract is no longer available.', 404, 'NOT_FOUND');
    }

    // Build response based on permission level
    const response = {
        title: contract.title,
        type: contract.type,
        tags: contract.tags,
        parties: contract.parties,
        effectiveDate: contract.effectiveDate,
        expiryDate: contract.expiryDate,
    };

    if (link.permissions === 'view_content' || link.permissions === 'view_analysis') {
        response.content = contract.content;
        response.jurisdiction = contract.jurisdiction;
    }

    if (link.permissions === 'view_analysis') {
        const analysis = await Analysis.findOne({
            contractId: link.contractId,
            status: 'completed',
        })
            .sort({ createdAt: -1 })
            .lean();

        if (analysis) {
            response.analysis = {
                summary: analysis.summary,
                riskScore: analysis.riskScore,
                riskLevel: analysis.riskLevel,
                clauses: analysis.clauses,
                obligations: analysis.obligations,
                keyDates: analysis.keyDates,
            };
        }
    }

    return response;
}
