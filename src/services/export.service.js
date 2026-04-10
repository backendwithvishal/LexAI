/**
 * Export Service
 *
 * Generates structured export payloads for contracts and analyses.
 * Exports are returned as JSON — PDF generation would be a future
 * enhancement using a library like puppeteer or pdfkit.
 *
 * All exports are org-scoped for data isolation.
 */

import Contract from '../models/Contract.model.js';
import Analysis from '../models/Analysis.model.js';
import { buildPaginationMeta } from '../utils/apiResponse.js';
import AppError from '../utils/AppError.js';

/**
 * Export contracts list for the org.
 * Returns metadata without full content to keep payload manageable.
 */
export async function exportContracts(orgId, query = {}) {
    const { type, tag, status } = query;

    const filter = { orgId, isDeleted: false };
    if (type) filter.type = type;
    if (tag) filter.tags = tag;

    // If status=expired, filter for contracts past their expiry date
    if (status === 'expired') {
        filter.expiryDate = { $lt: new Date() };
    } else if (status === 'active') {
        filter.$or = [
            { expiryDate: { $gte: new Date() } },
            { expiryDate: { $exists: false } },
        ];
    }

    const contracts = await Contract.find(filter)
        .select('-content -versions') // Exclude heavy fields
        .sort({ createdAt: -1 })
        .lean();

    return {
        exportedAt: new Date().toISOString(),
        totalRecords: contracts.length,
        filters: { type, tag, status },
        contracts,
    };
}

/**
 * Export a single contract's full report including analysis data.
 */
export async function exportContractReport(contractId, orgId) {
    const contract = await Contract.findOne({ _id: contractId, orgId, isDeleted: false })
        .select('-versions.content') // Include version metadata but not full content per version
        .lean();

    if (!contract) {
        throw new AppError('Contract not found.', 404, 'NOT_FOUND');
    }

    // Get the latest completed analysis for this contract
    const latestAnalysis = await Analysis.findOne({
        contractId,
        orgId,
        status: 'completed',
    })
        .sort({ createdAt: -1 })
        .lean();

    return {
        exportedAt: new Date().toISOString(),
        contract: {
            id: contract._id,
            title: contract.title,
            type: contract.type,
            tags: contract.tags,
            currentVersion: contract.currentVersion,
            parties: contract.parties,
            effectiveDate: contract.effectiveDate,
            expiryDate: contract.expiryDate,
            renewalDate: contract.renewalDate,
            jurisdiction: contract.jurisdiction,
            createdAt: contract.createdAt,
            updatedAt: contract.updatedAt,
            content: contract.content,
        },
        analysis: latestAnalysis
            ? {
                id: latestAnalysis._id,
                summary: latestAnalysis.summary,
                riskScore: latestAnalysis.riskScore,
                riskLevel: latestAnalysis.riskLevel,
                clauses: latestAnalysis.clauses,
                obligations: latestAnalysis.obligations,
                keyDates: latestAnalysis.keyDates,
                analyzedAt: latestAnalysis.createdAt,
                aiModel: latestAnalysis.aiModel,
            }
            : null,
        versionHistory: (contract.versions || []).map((v) => ({
            versionNumber: v.versionNumber,
            uploadedAt: v.uploadedAt,
            changeNote: v.changeNote,
            contentHash: v.contentHash,
        })),
    };
}

/**
 * Export all analyses summary for the org.
 */
export async function exportAnalyses(orgId, query = {}) {
    const { status, riskLevel } = query;

    const filter = { orgId };
    if (status) filter.status = status;
    if (riskLevel) filter.riskLevel = riskLevel;

    const analyses = await Analysis.find(filter)
        .select('-clauses -obligations') // Lighter export — full detail via single report
        .sort({ createdAt: -1 })
        .populate('contractId', 'title type')
        .lean();

    return {
        exportedAt: new Date().toISOString(),
        totalRecords: analyses.length,
        filters: { status, riskLevel },
        analyses,
    };
}
