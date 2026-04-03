/**
 * Analytics Routes
 *
 * Base path: /api/v1/analytics  (mounted in routes/index.js)
 *
 * All endpoints require authentication + admin role.
 *
 *   GET /sales         — Sales analytics (revenue, orders over time)
 *   GET /products      — Product performance analytics
 *   GET /users         — User activity statistics
 *   GET /revenue       — Revenue trend analytics
 *   GET /top-products  — Top products by sales volume
 */

import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/rbac.middleware.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const router = Router();

// All analytics routes require authentication + admin role
router.use(authenticate);
router.use(authorize('admin'));

router.get('/sales', asyncWrapper(analyticsController.getSalesAnalytics));
router.get('/products', asyncWrapper(analyticsController.getProductAnalytics));
router.get('/users', asyncWrapper(analyticsController.getUserActivityAnalytics));
router.get('/revenue', asyncWrapper(analyticsController.getRevenueAnalytics));
router.get('/top-products', asyncWrapper(analyticsController.getTopProducts));

export default router;
