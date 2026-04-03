/**
 * Product Routes
 *
 * Base path: /api/v1/products  (mounted in routes/index.js)
 *
 * All endpoints require authentication.
 *
 *   POST   /                — Create a product
 *   GET    /                — List products (pagination, filtering, sorting)
 *   GET    /search          — Full-text search products
 *   GET    /:id             — Get product by ID
 *   PATCH  /:id             — Update product (owner only)
 *   DELETE /:id             — Delete product (owner only)
 *   GET    /:id/reviews     — Get product reviews (delegated to review controller)
 */

import { Router } from 'express';
import * as productController from '../controllers/product.controller.js';
import * as reviewController from '../controllers/review.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';
import {
    createProductSchema,
    updateProductSchema,
    listProductsSchema,
} from '../validators/product.validator.js';
import { listReviewsSchema } from '../validators/review.validator.js';

const router = Router();

// All product routes require authentication
router.use(authenticate);

router.post('/', validate(createProductSchema), asyncWrapper(productController.createProduct));
router.get('/', validate(listProductsSchema, 'query'), asyncWrapper(productController.listProducts));

// search must be before /:id to prevent "search" being matched as an ID
router.get('/search', asyncWrapper(productController.searchProducts));

router.get('/:id', asyncWrapper(productController.getProduct));
router.patch('/:id', validate(updateProductSchema), asyncWrapper(productController.updateProduct));
router.delete('/:id', asyncWrapper(productController.deleteProduct));

// Product reviews — uses review controller but mounted under products for clean API
router.get('/:id/reviews', validate(listReviewsSchema, 'query'), asyncWrapper((req, res) => {
    req.params.productId = req.params.id;
    return reviewController.getProductReviews(req, res);
}));

export default router;
