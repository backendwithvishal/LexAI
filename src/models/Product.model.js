/**
 * Product Model
 *
 * Represents a product in the marketplace. Supports full-text search
 * on name/description, category filtering, and embedded rating stats
 * that are updated asynchronously when reviews are added.
 */

import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Product name is required'],
            trim: true,
            maxlength: [200, 'Product name cannot exceed 200 characters'],
        },
        description: {
            type: String,
            required: [true, 'Product description is required'],
            trim: true,
            maxlength: [5000, 'Description cannot exceed 5000 characters'],
        },
        price: {
            type: Number,
            required: [true, 'Price is required'],
            min: [0, 'Price cannot be negative'],
        },
        category: {
            type: String,
            required: [true, 'Category is required'],
            trim: true,
            lowercase: true,
        },
        stock: {
            type: Number,
            required: true,
            min: [0, 'Stock cannot be negative'],
            default: 0,
        },
        images: [{
            type: String,
            trim: true,
        }],
        tags: [{
            type: String,
            trim: true,
            lowercase: true,
        }],
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        averageRating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
        },
        totalReviews: {
            type: Number,
            default: 0,
            min: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
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
productSchema.index({ category: 1, price: 1 });           // Category + price range queries
productSchema.index({ userId: 1, createdAt: -1 });        // User's products (newest first)
productSchema.index({ isActive: 1, createdAt: -1 });      // Active products listing
productSchema.index({ name: 'text', description: 'text' }); // Full-text search
productSchema.index({ tags: 1 });                         // Tag-based filtering

const Product = mongoose.model('Product', productSchema);

export default Product;
