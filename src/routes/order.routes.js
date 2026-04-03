/**
 * Order Routes
 *
 * Base path: /api/v1/orders  (mounted in routes/index.js)
 *
 * All endpoints require authentication.
 *
 *   POST   /                — Create a new order
 *   GET    /                — List user orders (paginated)
 *   GET    /stats           — Get order statistics
 *   GET    /:id             — Get order by ID
 *   PATCH  /:id/status      — Update order status
 *   PATCH  /:id/cancel      — Cancel an order
 */

import { Router } from 'express';
import * as orderController from '../controllers/order.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';
import {
    createOrderSchema,
    updateOrderStatusSchema,
    listOrdersSchema,
} from '../validators/order.validator.js';

const router = Router();

// All order routes require authentication
router.use(authenticate);

router.post('/', validate(createOrderSchema), asyncWrapper(orderController.createOrder));
router.get('/', validate(listOrdersSchema, 'query'), asyncWrapper(orderController.listOrders));

// stats must be before /:id to prevent "stats" being matched as an ID
router.get('/stats', asyncWrapper(orderController.getOrderStats));

router.get('/:id', asyncWrapper(orderController.getOrder));
router.patch('/:id/status', validate(updateOrderStatusSchema), asyncWrapper(orderController.updateOrderStatus));
router.patch('/:id/cancel', asyncWrapper(orderController.cancelOrder));

export default router;
