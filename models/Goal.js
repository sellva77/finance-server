const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    goalName: {
        type: String,
        required: [true, 'Please provide goal name'],
        trim: true,
        maxlength: [100, 'Goal name cannot exceed 100 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [300, 'Description cannot exceed 300 characters']
    },
    targetAmount: {
        type: Number,
        required: [true, 'Please provide target amount'],
        min: [1, 'Target amount must be at least 1']
    },
    savedAmount: {
        type: Number,
        default: 0,
        min: [0, 'Saved amount cannot be negative']
    },
    deadline: {
        type: Date,
        required: [true, 'Please provide a deadline']
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['active', 'completed', 'cancelled'],
        default: 'active'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date,
        default: null
    }
});

// Virtual for progress percentage
goalSchema.virtual('progress').get(function () {
    return Math.min(100, Math.round((this.savedAmount / this.targetAmount) * 100));
});

// Ensure virtuals are included in JSON output
goalSchema.set('toJSON', { virtuals: true });
goalSchema.set('toObject', { virtuals: true });

// Index for efficient querying
goalSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Goal', goalSchema);
