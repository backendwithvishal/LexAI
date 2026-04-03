/**
 * Order Model
 *
 * Represents a user order with line items, status tracking,
 * shipping address, and payment method. Status transitions
 * emit RabbitMQ events for notification and analytics consumers.
 */

import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        quantity: {
            type: Number,
            required: true,
            min: [1, 'Quantity must be at least 1'],
        },
        price: {
            type: Number,
            required: true,
            min: [0, 'Price cannot be negative'],
        },
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        items: {
            type: [orderItemSchema],
            required: true,
            validate: {
                validator: (v) => v.length > 0,
                message: 'Order must contain at least one item',
            },
        },
        totalAmount: {
            type: Number,
            required: true,
            min: [0, 'Total amount cannot be negative'],
        },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
            default: 'pending',
        },
        shippingAddress: {
            street: { type: String, trim: true },
            city: { type: String, trim: true },
            state: { type: String, trim: true },
            zipCode: { type: String, trim: true },
            country: { type: String, trim: true },
        },
        paymentMethod: {
            type: String,
            enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'cash_on_delivery'],
            default: 'credit_card',
        },
        cancelledAt: Date,
        cancelReason: String,
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
orderSchema.index({ userId: 1, createdAt: -1 });  // User's order history
orderSchema.index({ status: 1, createdAt: -1 });  // Orders by status
orderSchema.index({ createdAt: -1 });              // Recent orders first

const Order = mongoose.model('Order', orderSchema);

export default Order;
