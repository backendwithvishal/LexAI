/**
 * Route Aggregator
 *
 * Mounts all route modules under their respective prefixes.
 * All routes here are prefixed with /api/v1 in app.js.
 *
 * Full base paths:
 *   /api/v1/auth          — Authentication (register, login, tokens)
 *   /api/v1/users         — User profile management
 *   /api/v1/orgs          — Organization management
 *   /api/v1/contracts     — Contract CRUD, versioning, status, and comments
 *   /api/v1/analyses      — AI analysis requests and results
 *   /api/v1/ai            — AI-powered features (Q&A, summarize, compliance, etc.)
 *   /api/v1/notifications — In-app notification feed
 *   /api/v1/enrichment    — Public API enrichment data
 *   /api/v1/admin         — Admin-only platform management
 *   /api/v1/dashboard     — Org-level analytics and statistics
 *   /api/v1/tags          — Tag management across contracts
 *   /api/v1/bookmarks     — Bookmark/favorite contracts
 *   /api/v1/templates     — Reusable contract templates
 *   /api/v1/shares        — Contract sharing with external parties
 *   /api/v1/exports       — Data export (contracts, analyses)
 *   /api/v1/bulk          — Bulk operations on contracts
 *   /api/v1/preferences   — User display and notification preferences
 *   /api/v1/reports       — Compliance and risk reports
 */

import { Router } from 'express';

import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import orgRoutes from './org.routes.js';
import contractRoutes from './contract.routes.js';
import analysisRoutes from './analysis.routes.js';
import aiRoutes from './ai.routes.js';
import notificationRoutes from './notification.routes.js';
import enrichmentRoutes from './enrichment.routes.js';
import adminRoutes from './admin.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import tagRoutes from './tag.routes.js';
import bookmarkRoutes from './bookmark.routes.js';
import templateRoutes from './template.routes.js';
import shareRoutes from './share.routes.js';
import exportRoutes from './export.routes.js';
import bulkRoutes from './bulk.routes.js';
import preferenceRoutes from './preference.routes.js';
import reportRoutes from './report.routes.js';

const router = Router();

// ─── Core API Modules ─────────────────────────────────────────────────────────
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/orgs', orgRoutes);
router.use('/contracts', contractRoutes);  // Includes /comments and /status sub-routes
router.use('/analyses', analysisRoutes);
router.use('/ai', aiRoutes);
router.use('/notifications', notificationRoutes);
router.use('/enrichment', enrichmentRoutes);
router.use('/admin', adminRoutes);

// ─── Extended API Modules ─────────────────────────────────────────────────────
router.use('/dashboard', dashboardRoutes);
router.use('/tags', tagRoutes);
router.use('/bookmarks', bookmarkRoutes);
router.use('/templates', templateRoutes);
router.use('/shares', shareRoutes);
router.use('/exports', exportRoutes);
router.use('/bulk', bulkRoutes);
router.use('/preferences', preferenceRoutes);
router.use('/reports', reportRoutes);

export default router;
