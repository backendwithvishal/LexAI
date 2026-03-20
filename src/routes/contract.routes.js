/**
 * Contract Routes
 *
 * Base path: /api/v1/contracts  (mounted in routes/index.js)
 *
 * All endpoints require authentication + org membership (requireOrg).
 * File uploads use multer with memory storage — files are processed in-memory
 * and never written to disk. Text is extracted and the original file is discarded.
 *
 * Rate limits:
 *   upload   — 20 req / min (file uploads and version uploads)
 *   analysis — 30 req / min (version comparison, which queues AI jobs)
 */

import { Router } from 'express';
import multer from 'multer';
import * as contractController from '../controllers/contract.controller.js';
import * as diffController from '../controllers/diff.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { requireOrg } from '../middleware/orgResolver.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { rateLimiter } from '../middleware/rateLimiter.middleware.js';
import { sendError } from '../utils/apiResponse.js';
import HTTP from '../constants/httpStatus.js';
import * as contractValidator from '../validators/contract.validator.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';
import env from '../config/env.js';

const router = Router();

// Allowed MIME types — validated against magic bytes in the controller
const ALLOWED_MIME_TYPES = (env.ALLOWED_MIME_TYPES || '').split(',').map(t => t.trim());

// Multer config — memory storage, strict size + type limits
const upload = multer({
    storage: multer.memoryStorage(),  // Keep file in RAM — never write to disk
    limits: {
        fileSize: (parseInt(env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024,
        files: 1,       // Only one file per request
        fields: 10,     // Limit non-file fields to prevent abuse
        fieldSize: 10 * 1024, // 10KB max per field value
    },
    fileFilter(req, file, cb) {
        // Reject unsupported file types before they're even buffered
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`));
        }
    },
});

// Wrapper that converts multer errors into structured API error responses
function handleUpload(req, res, next) {
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return sendError(res, {
                    statusCode: HTTP.BAD_REQUEST,
                    code: 'FILE_TOO_LARGE',
                    message: `File exceeds the maximum size of ${env.MAX_FILE_SIZE_MB || 5}MB.`,
                });
            }
            return sendError(res, { statusCode: HTTP.BAD_REQUEST, code: 'UPLOAD_ERROR', message: err.message });
        }
        if (err) {
            return sendError(res, { statusCode: HTTP.BAD_REQUEST, code: 'UPLOAD_ERROR', message: err.message });
        }
        next();
    });
}

// ─── Contract CRUD ────────────────────────────────────────────────────────────
router.post('/',   authenticate, requireOrg, rateLimiter('upload'), handleUpload, validate(contractValidator.uploadContract), asyncWrapper(contractController.uploadContract));
router.get('/',    authenticate, requireOrg, validate(contractValidator.listContracts, 'query'), asyncWrapper(contractController.listContracts));
router.get('/:id', authenticate, requireOrg, asyncWrapper(contractController.getContract));
router.patch('/:id', authenticate, requireOrg, validate(contractValidator.updateContract), asyncWrapper(contractController.updateContract));
// Delete requires admin or manager — viewers can't delete contracts
router.delete('/:id', authenticate, requireOrg, authorize('admin', 'manager'), asyncWrapper(contractController.deleteContract));

// ─── Version management ───────────────────────────────────────────────────────
router.post('/:id/versions', authenticate, requireOrg, rateLimiter('upload'), validate(contractValidator.uploadVersion), asyncWrapper(contractController.uploadVersion));
router.get('/:id/versions',  authenticate, requireOrg, asyncWrapper(contractController.getVersions));

// ─── Version comparison (Pro/Enterprise only) ─────────────────────────────────
router.post('/:id/compare', authenticate, requireOrg, rateLimiter('analysis'), validate(contractValidator.compareVersions), asyncWrapper(diffController.compareVersions));

// ─── Audit trail ──────────────────────────────────────────────────────────────
router.get('/:id/audit', authenticate, requireOrg, asyncWrapper(contractController.getContractAudit));

export default router;
