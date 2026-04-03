/**
 * Product Controller
 *
 * Thin HTTP layer for product CRUD, search, and listing.
 * All business logic lives in product.service.js.
 */

import * as productService from '../services/product.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import HTTP from '../constants/httpStatus.js';

/** POST /products — Create a new product */
export async function createProduct(req, res) {
    const product = await productService.createProduct(req.user.userId, req.body);
    sendSuccess(res, {
        statusCode: HTTP.CREATED,
        message: 'Product created successfully.',
        data: { product },
    });
}

/** GET /products — List products with pagination, filtering, sorting */
export async function listProducts(req, res) {
    const { products, meta } = await productService.listProducts(req.query);
    sendSuccess(res, { data: { products, meta } });
}

/** GET /products/search — Full-text search products */
export async function searchProducts(req, res) {
    const { products, meta } = await productService.searchProducts(req.query);
    sendSuccess(res, { data: { products, meta } });
}

/** GET /products/:id — Get product by ID */
export async function getProduct(req, res) {
    const product = await productService.getProductById(req.params.id);
    sendSuccess(res, { data: { product } });
}

/** PATCH /products/:id — Update product (owner only) */
export async function updateProduct(req, res) {
    const product = await productService.updateProduct(req.params.id, req.user.userId, req.body);
    sendSuccess(res, { message: 'Product updated successfully.', data: { product } });
}

/** DELETE /products/:id — Delete product (owner only) */
export async function deleteProduct(req, res) {
    await productService.deleteProduct(req.params.id, req.user.userId);
    sendSuccess(res, { message: 'Product deleted successfully.' });
}
