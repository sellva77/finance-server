const mongoose = require('mongoose');

const recurringTransactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Please provide a name for this recurring transaction'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    type: {
        type: String,
        enum: ['income', 'expense', 'transfer', 'investment'],
        required: [true, 'Please specify transaction type']
    },
    fromAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        default: null
    },
    toAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        default: null
    },
    amount: {
        type: Number,
        required: [true, 'Please provide transaction amount'],
        min: [0.01, 'Amount must be greater than 0']
    },
    category: {
        type: String,
        required: [true, 'Please provide a category'],
        trim: true
    },
    paymentMode: {
        type: String,
        enum: ['cash', 'upi', 'card', 'bank_transfer', 'other'],
        default: 'bank_transfer'
    },
    note: {
        type: String,
        trim: true,
        maxlength: [500, 'Note cannot exceed 500 characters']
    },
    // Recurrence settings
    frequency: {
        type: String,
        enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'],
        required: [true, 'Please specify frequency']
    },
    dayOfMonth: {
        type: Number,
        min: 1,
        max: 31,
        default: 1 // For monthly/quarterly/yearly
    },
    dayOfWeek: {
        type: Number,
        min: 0,
        max: 6,
        default: null // For weekly (0 = Sunday)
    },
    startDate: {
        type: Date,
        required: [true, 'Please provide a start date'],
        default: Date.now
    },
    endDate: {
        type: Date,
        default: null // null = infinite
    },
    nextRunDate: {
        type: Date,
        required: true
    },
    lastRunDate: {
        type: Date,
        default: null
    },
    // Status
    isActive: {
        type: Boolean,
        default: true
    },
    isPaused: {
        type: Boolean,
        default: false
    },
    // Tracking
    totalExecutions: {
        type: Number,
        default: 0
    },
    maxExecutions: {
        type: Number,
        default: null // null = unlimited
    },
    // Notifications
    notifyBefore: {
        type: Number,
        default: 1 // Days before to notify
    },
    notifyOnExecution: {
        type: Boolean,
        default: true
    },
    // Tags
    tags: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tag'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Calculate next run date based on frequency
recurringTransactionSchema.methods.calculateNextRunDate = function() {
    const now = new Date();
    let nextDate = new Date(this.nextRunDate);

    switch (this.frequency) {
        case 'daily':
            nextDate.setDate(nextDate.getDate() + 1);
            break;
        case 'weekly':
            nextDate.setDate(nextDate.getDate() + 7);
            break;
        case 'biweekly':
            nextDate.setDate(nextDate.getDate() + 14);
            break;
        case 'monthly':
            nextDate.setMonth(nextDate.getMonth() + 1);
            // Handle end of month edge cases
            if (this.dayOfMonth) {
                const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
                nextDate.setDate(Math.min(this.dayOfMonth, lastDayOfMonth));
            }
            break;
        case 'quarterly':
            nextDate.setMonth(nextDate.getMonth() + 3);
            break;
        case 'yearly':
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
    }

    return nextDate;
};

// Check if this recurring transaction should be executed
recurringTransactionSchema.methods.shouldExecute = function() {
    if (!this.isActive || this.isPaused) return false;
    if (this.endDate && new Date() > this.endDate) return false;
    if (this.maxExecutions && this.totalExecutions >= this.maxExecutions) return false;
    return new Date() >= this.nextRunDate;
};

// Index for efficient querying
recurringTransactionSchema.index({ userId: 1, isActive: 1 });
recurringTransactionSchema.index({ nextRunDate: 1, isActive: 1 });
recurringTransactionSchema.index({ userId: 1, frequency: 1 });

// Update timestamp on save
recurringTransactionSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('RecurringTransaction', recurringTransactionSchema);
