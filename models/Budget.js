const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    category: {
        type: String,
        required: [true, 'Please provide category'],
        trim: true
    },
    monthlyLimit: {
        type: Number,
        required: [true, 'Please provide monthly limit'],
        min: [0, 'Limit cannot be negative']
    },
    currentSpent: {
        type: Number,
        default: 0
    },
    month: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    year: {
        type: Number,
        required: true
    },
    alertThreshold: {
        type: Number,
        default: 80, // Alert when 80% spent
        min: 0,
        max: 100
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Virtual for remaining budget
budgetSchema.virtual('remaining').get(function () {
    return Math.max(0, this.monthlyLimit - this.currentSpent);
});

// Virtual for spent percentage
budgetSchema.virtual('spentPercent').get(function () {
    if (this.monthlyLimit === 0) return 0;
    return Math.round((this.currentSpent / this.monthlyLimit) * 100);
});

// Virtual for alert status
budgetSchema.virtual('isOverBudget').get(function () {
    return this.currentSpent > this.monthlyLimit;
});

budgetSchema.virtual('isNearLimit').get(function () {
    return this.spentPercent >= this.alertThreshold;
});

// Ensure virtuals are included in JSON output
budgetSchema.set('toJSON', { virtuals: true });
budgetSchema.set('toObject', { virtuals: true });

// Compound index for unique budget per user, category, month, year
budgetSchema.index({ userId: 1, category: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
