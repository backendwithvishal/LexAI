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
 *   /api/v1/products      — Product CRUD and search
 *   /api/v1/orders        — Order management
 *   /api/v1/reviews       — Product reviews
 *   /api/v1/analytics     — Admin analytics dashboards
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
import productRoutes from './product.routes.js';
import orderRoutes from './order.routes.js';
import reviewRoutes from './review.routes.js';
import analyticsRoutes from './analytics.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/orgs', orgRoutes);
router.use('/contracts', contractRoutes);
router.use('/analyses', analysisRoutes);
router.use('/notifications', notificationRoutes);
router.use('/enrichment', enrichmentRoutes);
router.use('/admin', adminRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/reviews', reviewRoutes);
router.use('/analytics', analyticsRoutes);

export default router;

