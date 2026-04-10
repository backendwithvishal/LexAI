/**
 * Status Service
 *
 * Manages contract lifecycle status/workflow transitions.
 * Status is tracked as a field on the Contract model and
 * each transition is recorded in the audit log.
 *
 * Lifecycle: draft → review → approved → signed → active → expired → terminated
 *
 * This service adds workflow on top of the existing contract model
 * without modifying the schema — using the metadata pattern.
 */

import Contract from '../models/Contract.model.js';
import AuditLog from '../models/AuditLog.model.js';
import * as auditService from './audit.service.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

// Valid status values and allowed transitions
const VALID_STATUSES = ['draft', 'review', 'approved', 'signed', 'active', 'expired', 'terminated'];

const TRANSITIONS = {
    draft: ['review', 'terminated'],
    review: ['approved', 'draft', 'terminated'],
    approved: ['signed', 'review', 'terminated'],
    signed: ['active', 'terminated'],
    active: ['expired', 'terminated'],
    expired: ['active'],       // Re-activate after renewal
    terminated: [],             // Terminal state — no further transitions
};

/**
 * Get the current workflow status for a contract.
 * Status is stored in the contract's metadata or defaults to 'draft'.
 */
export async function getContractStatus(contractId, orgId) {
    const contract = await Contract.findOne({ _id: contractId, orgId, isDeleted: false })
        .select('title type status')
        .lean();

    if (!contract) {
        throw new AppError('Contract not found.', 404, 'NOT_FOUND');
    }

    const currentStatus = contract.status || 'draft';

    return {
        contractId: contract._id,
        title: contract.title,
        currentStatus,
        allowedTransitions: TRANSITIONS[currentStatus] || [],
        allStatuses: VALID_STATUSES,
    };
}

/**
 * Update the workflow status of a contract.
 * Validates that the transition is allowed.
 */
export async function updateContractStatus(contractId, orgId, userId, newStatus, note) {
    if (!VALID_STATUSES.includes(newStatus)) {
        throw new AppError(
            `Invalid status "${newStatus}". Must be one of: ${VALID_STATUSES.join(', ')}`,
            400,
            'INVALID_STATUS'
        );
    }

    const contract = await Contract.findOne({ _id: contractId, orgId, isDeleted: false });
    if (!contract) {
        throw new AppError('Contract not found.', 404, 'NOT_FOUND');
    }

    const currentStatus = contract.status || 'draft';

    // Validate transition
    const allowed = TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
        throw new AppError(
            `Cannot transition from "${currentStatus}" to "${newStatus}". Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
            400,
            'INVALID_TRANSITION'
        );
    }

    contract.status = newStatus;
    await contract.save();

    logger.info({ orgId, contractId, userId, from: currentStatus, to: newStatus }, 'Contract status updated');

    // Audit the status change
    await auditService.log({
        orgId,
        userId,
        action: 'contract.status_changed',
        resourceType: 'Contract',
        resourceId: contractId,
        metadata: { from: currentStatus, to: newStatus, note },
    });

    return {
        contractId,
        previousStatus: currentStatus,
        currentStatus: newStatus,
        allowedTransitions: TRANSITIONS[newStatus] || [],
    };
}

/**
 * Get status change history for a contract from audit logs.
 */
export async function getStatusHistory(contractId, orgId) {
    const logs = await AuditLog.find({
        orgId,
        resourceType: 'Contract',
        resourceId: contractId,
        action: 'contract.status_changed',
    })
        .sort({ createdAt: -1 })
        .populate('userId', 'name email')
        .lean();

    return logs.map((log) => ({
        from: log.metadata?.from,
        to: log.metadata?.to,
        note: log.metadata?.note,
        changedBy: log.userId,
        changedAt: log.createdAt,
    }));
}
