/**
 * Review Model
 *
 * Product reviews with rating (1-5). Enforces one review per user
 * per product via compound unique index. Average rating on the
 * Product model is recalculated asynchronously after review events.
 */

import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
        },
        rating: {
            type: Number,
            required: [true, 'Rating is required'],
            min: [1, 'Rating must be at least 1'],
            max: [5, 'Rating cannot exceed 5'],
        },
        title: {
            type: String,
            trim: true,
            maxlength: [200, 'Review title cannot exceed 200 characters'],
        },
        comment: {
            type: String,
            trim: true,
            maxlength: [2000, 'Review comment cannot exceed 2000 characters'],
        },
    },
    {
        timestamps: true,
        toJSON: {
            transform(doc, ret) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    }
);

// ─── Indexes ──────────────────────────────────────────────────────
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true }); // One review per user per product
reviewSchema.index({ productId: 1, createdAt: -1 });              // Product reviews (newest first)
reviewSchema.index({ userId: 1, createdAt: -1 });                 // User's reviews

const Review = mongoose.model('Review', reviewSchema);

export default Review;
