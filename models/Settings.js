const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    currency: {
        code: {
            type: String,
            default: 'INR',
            enum: ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SGD', 'AED', 'SAR', 'BRL', 'MXN', 'ZAR', 'NZD', 'KRW', 'THB', 'MYR', 'PHP', 'IDR', 'VND', 'TWD', 'HKD', 'RUB', 'TRY', 'PLN', 'SEK', 'NOK', 'DKK', 'CZK', 'HUF', 'ILS', 'CLP', 'COP', 'PEN', 'ARS', 'EGP', 'PKR', 'BDT', 'LKR', 'NGN', 'KES', 'GHS', 'TZS', 'UGX', 'MAD', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD']
        },
        symbol: {
            type: String,
            default: '₹'
        },
        name: {
            type: String,
            default: 'Indian Rupee'
        },
        locale: {
            type: String,
            default: 'en-IN'
        }
    },
    dateFormat: {
        type: String,
        default: 'DD/MM/YYYY',
        enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY', 'MMM DD, YYYY']
    },
    theme: {
        type: String,
        default: 'dark',
        enum: ['dark', 'light', 'system']
    },
    notifications: {
        budgetAlerts: {
            type: Boolean,
            default: true
        },
        goalReminders: {
            type: Boolean,
            default: true
        },
        transactionAlerts: {
            type: Boolean,
            default: false
        }
    },
    conversionRates: {
        type: Map,
        of: Number,
        default: {}
    },
    defaultAccount: {
        type: mongoose.Schema.ObjectId,
        ref: 'Account',
        default: null
    },
    fiscalYearStart: {
        type: Number,
        default: 4, // April (1 = January, 12 = December)
        min: 1,
        max: 12
    },
    numberFormat: {
        decimalSeparator: {
            type: String,
            default: '.',
            enum: ['.', ',']
        },
        thousandSeparator: {
            type: String,
            default: ',',
            enum: [',', '.', ' ', '']
        },
        decimalPlaces: {
            type: Number,
            default: 2,
            min: 0,
            max: 4
        }
    },
    dashboardLayout: {
        showNetWorth: { type: Boolean, default: true },
        showRecentTransactions: { type: Boolean, default: true },
        showBudgetOverview: { type: Boolean, default: true },
        showGoalsProgress: { type: Boolean, default: true },
        showExpenseChart: { type: Boolean, default: true },
        showIncomeChart: { type: Boolean, default: true },
        showAccountBalances: { type: Boolean, default: true },
        showUpcomingRecurring: { type: Boolean, default: true }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt field before saving
settingsSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Settings', settingsSchema);
