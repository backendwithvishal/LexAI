/**
 * Order Controller
 *
 * Thin HTTP layer for order operations.
 * All business logic (stock validation, status transitions) lives in order.service.js.
 */

import * as orderService from '../services/order.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import HTTP from '../constants/httpStatus.js';

/** POST /orders — Create a new order */
export async function createOrder(req, res) {
    const order = await orderService.createOrder(req.user.userId, req.body);
    sendSuccess(res, {
        statusCode: HTTP.CREATED,
        message: 'Order placed successfully.',
        data: { order },
    });
}

/** GET /orders — List user orders with pagination */
export async function listOrders(req, res) {
    const { orders, meta } = await orderService.listUserOrders(req.user.userId, req.query);
    sendSuccess(res, { data: { orders, meta } });
}

/** GET /orders/stats — Get order stats for user */
export async function getOrderStats(req, res) {
    const stats = await orderService.getOrderStats(req.user.userId);
    sendSuccess(res, { data: { stats } });
}

/** GET /orders/:id — Get order by ID */
export async function getOrder(req, res) {
    const order = await orderService.getOrderById(req.params.id, req.user.userId);
    sendSuccess(res, { data: { order } });
}

/** PATCH /orders/:id/status — Update order status */
export async function updateOrderStatus(req, res) {
    const order = await orderService.updateOrderStatus(
        req.params.id,
        req.user.userId,
        req.body.status
    );
    sendSuccess(res, { message: 'Order status updated.', data: { order } });
}

/** PATCH /orders/:id/cancel — Cancel an order */
export async function cancelOrder(req, res) {
    const order = await orderService.cancelOrder(
        req.params.id,
        req.user.userId,
        req.body.reason
    );
    sendSuccess(res, { message: 'Order cancelled successfully.', data: { order } });
}
