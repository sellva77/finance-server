const mongoose = require('mongoose');

// Sub-schema for tracking investment transactions (buy/sell/dividend)
const investmentTransactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['buy', 'sell', 'dividend', 'split', 'bonus'],
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    units: {
        type: Number,
        default: 0
    },
    pricePerUnit: {
        type: Number,
        default: 0
    },
    amount: {
        type: Number,
        required: true
    },
    notes: {
        type: String,
        trim: true
    }
}, { _id: true });

// Sub-schema for value history tracking
const valueHistorySchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    value: {
        type: Number,
        required: true
    },
    units: {
        type: Number,
        default: 0
    }
}, { _id: false });

const investmentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Please provide investment name'],
        trim: true,
        maxlength: [100, 'Investment name cannot exceed 100 characters']
    },
    symbol: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: [20, 'Symbol cannot exceed 20 characters']
    },
    type: {
        type: String,
        enum: ['stocks', 'mutual_funds', 'bonds', 'etf', 'crypto', 'real_estate', 'gold', 'fixed_deposit', 'sip', 'ppf', 'nps', 'other'],
        required: [true, 'Please specify investment type'],
        default: 'stocks'
    },
    investedAmount: {
        type: Number,
        required: [true, 'Please provide invested amount'],
        min: [0, 'Invested amount cannot be negative'],
        default: 0
    },
    currentValue: {
        type: Number,
        min: [0, 'Current value cannot be negative'],
        default: 0
    },
    units: {
        type: Number,
        default: 0
    },
    buyPrice: {
        type: Number,
        default: 0
    },
    currentPrice: {
        type: Number,
        default: 0
    },
    purchaseDate: {
        type: Date,
        required: [true, 'Please provide purchase date'],
        default: Date.now
    },
    maturityDate: {
        type: Date,
        default: null
    },
    interestRate: {
        type: Number,
        default: 0,
        min: [0, 'Interest rate cannot be negative']
    },
    // Dividend tracking
    dividendEnabled: {
        type: Boolean,
        default: false
    },
    dividendFrequency: {
        type: String,
        enum: ['monthly', 'quarterly', 'semi-annually', 'annually', 'irregular'],
        default: 'quarterly'
    },
    totalDividendsReceived: {
        type: Number,
        default: 0
    },
    lastDividendDate: {
        type: Date,
        default: null
    },
    lastDividendAmount: {
        type: Number,
        default: 0
    },
    // Transaction history for XIRR calculation
    transactions: [investmentTransactionSchema],
    // Value history for tracking performance over time
    valueHistory: [valueHistorySchema],
    notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    status: {
        type: String,
        enum: ['active', 'sold', 'matured', 'partial_sold'],
        default: 'active'
    },
    soldDate: {
        type: Date,
        default: null
    },
    soldAmount: {
        type: Number,
        default: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Virtual for absolute profit/loss
investmentSchema.virtual('profitLoss').get(function () {
    const totalValue = this.status === 'sold' ? this.soldAmount : this.currentValue;
    return (totalValue + this.totalDividendsReceived) - this.investedAmount;
});

// Virtual for profit/loss percentage
investmentSchema.virtual('profitLossPercent').get(function () {
    if (this.investedAmount === 0) return 0;
    const totalValue = this.status === 'sold' ? this.soldAmount : this.currentValue;
    return (((totalValue + this.totalDividendsReceived) - this.investedAmount) / this.investedAmount * 100);
});

// Virtual for days held
investmentSchema.virtual('daysHeld').get(function () {
    const endDate = this.soldDate || new Date();
    const startDate = new Date(this.purchaseDate);
    return Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
});

// Virtual for CAGR (Compound Annual Growth Rate)
investmentSchema.virtual('cagr').get(function () {
    if (this.investedAmount === 0 || this.daysHeld < 1) return 0;
    const years = this.daysHeld / 365;
    if (years < 0.1) return 0; // Avoid extreme values for very short periods
    
    const totalValue = this.status === 'sold' ? this.soldAmount : this.currentValue;
    const endValue = totalValue + this.totalDividendsReceived;
    
    // CAGR = (Ending Value / Beginning Value)^(1/Years) - 1
    const cagr = (Math.pow(endValue / this.investedAmount, 1 / years) - 1) * 100;
    return isFinite(cagr) ? cagr : 0;
});

// Virtual for absolute return
investmentSchema.virtual('absoluteReturn').get(function () {
    if (this.investedAmount === 0) return 0;
    const totalValue = this.status === 'sold' ? this.soldAmount : this.currentValue;
    return ((totalValue + this.totalDividendsReceived - this.investedAmount) / this.investedAmount * 100);
});

// Virtual for dividend yield
investmentSchema.virtual('dividendYield').get(function () {
    if (this.currentValue === 0 || this.totalDividendsReceived === 0) return 0;
    const years = Math.max(this.daysHeld / 365, 1);
    const annualDividend = this.totalDividendsReceived / years;
    return (annualDividend / this.currentValue * 100);
});

// Ensure virtuals are included in JSON output
investmentSchema.set('toJSON', { virtuals: true });
investmentSchema.set('toObject', { virtuals: true });

// Index for efficient querying
investmentSchema.index({ userId: 1, type: 1 });
investmentSchema.index({ userId: 1, status: 1 });
investmentSchema.index({ userId: 1, maturityDate: 1 });

// Pre-save middleware to update lastUpdated
investmentSchema.pre('save', function (next) {
    this.lastUpdated = new Date();
    next();
});

module.exports = mongoose.model('Investment', investmentSchema);
