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
 *   /api/v1/contracts     — Contract CRUD and versioning
 *   /api/v1/analyses      — AI analysis requests and results
 *   /api/v1/notifications — In-app notification feed
 *   /api/v1/enrichment    — Public API enrichment data
 *   /api/v1/admin         — Admin-only platform management
 */

import { Router } from 'express';

import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import orgRoutes from './org.routes.js';
import contractRoutes from './contract.routes.js';
import analysisRoutes from './analysis.routes.js';
import notificationRoutes from './notification.routes.js';
import enrichmentRoutes from './enrichment.routes.js';
import adminRoutes from './admin.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/orgs', orgRoutes);
router.use('/contracts', contractRoutes);
router.use('/analyses', analysisRoutes);
router.use('/notifications', notificationRoutes);
router.use('/enrichment', enrichmentRoutes);
router.use('/admin', adminRoutes);

export default router;
