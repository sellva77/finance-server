const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Please provide category name'],
        trim: true,
        maxlength: [50, 'Category name cannot exceed 50 characters']
    },
    type: {
        type: String,
        enum: ['income', 'expense'],
        required: [true, 'Please specify category type']
    },
    icon: {
        type: String,
        default: '📁'
    },
    color: {
        type: String,
        default: '#6366f1'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index for unique category names per user and type
categorySchema.index({ userId: 1, name: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
