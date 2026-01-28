const mongoose = require('mongoose');

const transactionLogSchema = new mongoose.Schema({
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    oldData: {
        type: Object,
        required: true
    },
    newData: {
        type: Object,
        required: true
    },
    modifiedAt: {
        type: Date,
        default: Date.now
    },
    reason: {
        type: String,
        required: [true, 'Please provide a reason for modification'],
        trim: true,
        maxlength: [300, 'Reason cannot exceed 300 characters']
    }
});

// Index for efficient audit log querying
transactionLogSchema.index({ transactionId: 1 });
transactionLogSchema.index({ userId: 1, modifiedAt: -1 });

module.exports = mongoose.model('TransactionLog', transactionLogSchema);
