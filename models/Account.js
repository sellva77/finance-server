const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    accountType: {
        type: String,
        required: [true, 'Please specify account type'],
        trim: true
        // Removed enum restriction - now accepts any type
    },
    accountName: {
        type: String,
        required: [true, 'Please provide account name'],
        trim: true
    },
    balance: {
        type: Number,
        default: 0,
        min: [0, 'Balance cannot be negative']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [200, 'Description cannot exceed 200 characters']
    },
    // Currency configuration per account
    currency: {
        code: {
            type: String,
            default: 'INR'
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
    // Custom styling options
    color: {
        type: String,
        default: '#6366f1' // Default indigo color
    },
    icon: {
        type: String,
        default: '💰' // Default emoji icon
    },
    status: {
        type: String,
        enum: ['active', 'locked'],
        default: 'active'
    },
    // Soft delete fields
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for user accounts - removed unique constraint on accountType
accountSchema.index({ userId: 1 });

module.exports = mongoose.model('Account', accountSchema);
