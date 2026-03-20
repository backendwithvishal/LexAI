/**
 * User Model
 *
 * Core user document with:
 *   - bcrypt password hashing via pre-save hook (12 salt rounds)
 *   - Organization reference and RBAC role
 *   - Automatic password exclusion from JSON serialization
 *
 * Security notes:
 *   - Password field uses `select: false` — never returned unless explicitly requested
 *   - toJSON transform strips internal MongoDB fields (_id → id, no __v)
 *   - Email verification tokens are stored in Redis, not in this document
 *   - Password reset tokens are stored in Redis, not in this document
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            maxlength: 100,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,       // This already creates the index — no schema.index() needed
            lowercase: true,    // Normalize to prevent duplicate accounts with different casing
            trim: true,
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: 8,
            select: false,      // Never returned in queries unless you call .select('+password')
        },

        // ─── Email Verification ──────────────────────────────────
        // Verification tokens live in Redis — not stored here
        emailVerified: { type: Boolean, default: false },

        // ─── Password Reset ──────────────────────────────────────
        // Reset tokens live in Redis — not stored here
        // passwordResetToken and passwordResetExpiry removed — were dead fields

        // ─── Organization & Role ─────────────────────────────────
        organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
        role: {
            type: String,
            enum: ['admin', 'manager', 'viewer'],
            default: 'viewer',  // Least privilege as safe default
        },

        isActive: { type: Boolean, default: true },     // Soft-disable without deleting
        lastLoginAt: Date,
    },
    {
        timestamps: true,
        toJSON: {
            transform(doc, ret) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                delete ret.password;
                return ret;
            },
        },
    }
);

// ─── Indexes ──────────────────────────────────────────────────────
// email index is already handled by unique: true on the field above — removed to prevent duplicate
userSchema.index({ organization: 1 });  // Fast lookups for listing users by org

// ─── Pre-save Hook: Hash password only when modified ──────────────
// Skips hashing if password hasn't changed (e.g. updating name or role)
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// ─── Instance Methods ─────────────────────────────────────────────

/**
 * Compare a candidate password against the stored hash.
 * Used during login — bcrypt.compare is timing-safe.
 *
 * @param {string} candidatePassword - Raw password from the request
 * @returns {Promise<boolean>} True if passwords match
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;