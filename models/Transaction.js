const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
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
        default: 'cash'
    },
    note: {
        type: String,
        trim: true,
        maxlength: [500, 'Note cannot exceed 500 characters']
    },
    // Currency conversion fields for cross-currency transfers
    conversionRate: {
        type: Number,
        default: null
    },
    convertedAmount: {
        type: Number,
        default: null
    },
    fromCurrency: {
        type: String,
        default: null
    },
    toCurrency: {
        type: String,
        default: null
    },
    transactionDate: {
        type: Date,
        required: [true, 'Please provide transaction date'],
        default: Date.now
    },
    // Tags for custom labeling (multi-tag support)
    tags: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tag'
    }],
    wasEdited: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient querying
transactionSchema.index({ userId: 1, transactionDate: -1 });
transactionSchema.index({ userId: 1, type: 1 });
transactionSchema.index({ userId: 1, category: 1 });
transactionSchema.index({ userId: 1, tags: 1 }); // Tag-based filtering index

// Pre-validate middleware to handle empty string account fields
transactionSchema.pre('validate', function(next) {
    // Convert empty strings to undefined (will use default null)
    if (this.fromAccount === '' || this.fromAccount === null) {
        this.fromAccount = undefined;
    }
    if (this.toAccount === '' || this.toAccount === null) {
        this.toAccount = undefined;
    }
    next();
});

// IMPORTANT: No delete operations allowed - this is enforced at controller level
// Transactions are APPEND-ONLY for lifetime financial logging

module.exports = mongoose.model('Transaction', transactionSchema);
