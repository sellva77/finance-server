const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Please provide tag name'],
        trim: true,
        maxlength: [30, 'Tag name cannot exceed 30 characters']
    },
    color: {
        type: String,
        default: '#6366f1',
        match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please provide valid hex color']
    },
    icon: {
        type: String,
        default: '🏷️'
    },
    description: {
        type: String,
        trim: true,
        maxlength: [100, 'Description cannot exceed 100 characters']
    },
    usageCount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index for unique tag names per user
tagSchema.index({ userId: 1, name: 1 }, { unique: true });

// Index for efficient querying
tagSchema.index({ userId: 1 });
tagSchema.index({ userId: 1, usageCount: -1 });

module.exports = mongoose.model('Tag', tagSchema);
