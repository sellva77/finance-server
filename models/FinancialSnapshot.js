const mongoose = require('mongoose');

const financialSnapshotSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    year: {
        type: Number,
        required: [true, 'Please provide year']
    },
    month: {
        type: Number,
        min: 1,
        max: 12,
        default: null // null means yearly snapshot, 1-12 means monthly
    },
    totalIncome: {
        type: Number,
        default: 0
    },
    totalExpense: {
        type: Number,
        default: 0
    },
    totalSavings: {
        type: Number,
        default: 0
    },
    totalInvestment: {
        type: Number,
        default: 0
    },
    netWorth: {
        type: Number,
        default: 0
    },
    categoryBreakdown: {
        income: [{
            category: String,
            amount: Number
        }],
        expense: [{
            category: String,
            amount: Number
        }]
    },
    accountBalances: [{
        accountType: String,
        balance: Number
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index for unique snapshots per user, year, and month
financialSnapshotSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('FinancialSnapshot', financialSnapshotSchema);
