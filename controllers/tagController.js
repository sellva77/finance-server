const Tag = require('../models/Tag');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

// Helper to validate ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// @desc    Get all tags for user
// @route   GET /api/tags
// @access  Private
exports.getTags = async (req, res, next) => {
    try {
        const tags = await Tag.find({ userId: req.user.id })
            .sort({ usageCount: -1, name: 1 });

        res.status(200).json({
            success: true,
            count: tags.length,
            data: tags
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single tag
// @route   GET /api/tags/:id
// @access  Private
exports.getTag = async (req, res, next) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid tag ID'
            });
        }

        const tag = await Tag.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!tag) {
            return res.status(404).json({
                success: false,
                message: 'Tag not found'
            });
        }

        res.status(200).json({
            success: true,
            data: tag
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new tag
// @route   POST /api/tags
// @access  Private
exports.createTag = async (req, res, next) => {
    try {
        req.body.userId = req.user.id;

        // Check for duplicate tag name
        const existingTag = await Tag.findOne({
            userId: req.user.id,
            name: { $regex: new RegExp(`^${req.body.name}$`, 'i') }
        });

        if (existingTag) {
            return res.status(400).json({
                success: false,
                message: 'Tag with this name already exists'
            });
        }

        const tag = await Tag.create(req.body);

        res.status(201).json({
            success: true,
            data: tag
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Tag with this name already exists'
            });
        }
        next(error);
    }
};

// @desc    Update tag
// @route   PUT /api/tags/:id
// @access  Private
exports.updateTag = async (req, res, next) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid tag ID'
            });
        }

        // Check for duplicate name if name is being changed
        if (req.body.name) {
            const existingTag = await Tag.findOne({
                userId: req.user.id,
                name: { $regex: new RegExp(`^${req.body.name}$`, 'i') },
                _id: { $ne: req.params.id }
            });

            if (existingTag) {
                return res.status(400).json({
                    success: false,
                    message: 'Tag with this name already exists'
                });
            }
        }

        const tag = await Tag.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            req.body,
            { new: true, runValidators: true }
        );

        if (!tag) {
            return res.status(404).json({
                success: false,
                message: 'Tag not found'
            });
        }

        res.status(200).json({
            success: true,
            data: tag
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete tag
// @route   DELETE /api/tags/:id
// @access  Private
exports.deleteTag = async (req, res, next) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid tag ID'
            });
        }

        const tag = await Tag.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!tag) {
            return res.status(404).json({
                success: false,
                message: 'Tag not found'
            });
        }

        // Remove this tag from all transactions
        await Transaction.updateMany(
            { userId: req.user.id, tags: req.params.id },
            { $pull: { tags: req.params.id } }
        );

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get tag analytics (transactions using each tag)
// @route   GET /api/tags/analytics
// @access  Private
exports.getTagAnalytics = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        // Build date filter
        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);

        const matchStage = {
            userId: new mongoose.Types.ObjectId(req.user.id),
            tags: { $exists: true, $ne: [] }
        };

        if (Object.keys(dateFilter).length > 0) {
            matchStage.transactionDate = dateFilter;
        }

        // Aggregate transactions by tag
        const tagStats = await Transaction.aggregate([
            { $match: matchStage },
            { $unwind: '$tags' },
            {
                $group: {
                    _id: '$tags',
                    transactionCount: { $sum: 1 },
                    totalAmount: { $sum: '$amount' },
                    incomeAmount: {
                        $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] }
                    },
                    expenseAmount: {
                        $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] }
                    }
                }
            },
            {
                $lookup: {
                    from: 'tags',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'tagInfo'
                }
            },
            { $unwind: '$tagInfo' },
            {
                $project: {
                    _id: 1,
                    name: '$tagInfo.name',
                    color: '$tagInfo.color',
                    icon: '$tagInfo.icon',
                    transactionCount: 1,
                    totalAmount: 1,
                    incomeAmount: 1,
                    expenseAmount: 1
                }
            },
            { $sort: { totalAmount: -1 } }
        ]);

        res.status(200).json({
            success: true,
            data: tagStats
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get popular/suggested tags
// @route   GET /api/tags/popular
// @access  Private
exports.getPopularTags = async (req, res, next) => {
    try {
        const tags = await Tag.find({ userId: req.user.id })
            .sort({ usageCount: -1 })
            .limit(10);

        res.status(200).json({
            success: true,
            data: tags
        });
    } catch (error) {
        next(error);
    }
};
