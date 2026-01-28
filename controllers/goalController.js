const Goal = require('../models/Goal');
const Account = require('../models/Account');

// @desc    Get all goals for user
// @route   GET /api/goals
// @access  Private
exports.getGoals = async (req, res, next) => {
    try {
        let query = { userId: req.user.id };

        // Filter by status
        if (req.query.status) {
            query.status = req.query.status;
        }

        const goals = await Goal.find(query).sort({ deadline: 1 });

        res.status(200).json({
            success: true,
            count: goals.length,
            data: goals
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get single goal
// @route   GET /api/goals/:id
// @access  Private
exports.getGoal = async (req, res, next) => {
    try {
        const goal = await Goal.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!goal) {
            return res.status(404).json({
                success: false,
                message: 'Goal not found'
            });
        }

        res.status(200).json({
            success: true,
            data: goal
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Create new goal
// @route   POST /api/goals
// @access  Private
exports.createGoal = async (req, res, next) => {
    try {
        req.body.userId = req.user.id;

        const goal = await Goal.create(req.body);

        res.status(201).json({
            success: true,
            data: goal
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update goal
// @route   PUT /api/goals/:id
// @access  Private
exports.updateGoal = async (req, res, next) => {
    try {
        let goal = await Goal.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!goal) {
            return res.status(404).json({
                success: false,
                message: 'Goal not found'
            });
        }

        goal = await Goal.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        // Auto-complete goal if target reached
        if (goal.savedAmount >= goal.targetAmount && goal.status !== 'completed') {
            goal.status = 'completed';
            goal.completedAt = new Date();
            await goal.save();
        }

        res.status(200).json({
            success: true,
            data: goal
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Add savings to goal
// @route   PUT /api/goals/:id/add
// @access  Private
exports.addToGoal = async (req, res, next) => {
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid amount'
            });
        }

        let goal = await Goal.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!goal) {
            return res.status(404).json({
                success: false,
                message: 'Goal not found'
            });
        }

        if (goal.status !== 'active') {
            return res.status(400).json({
                success: false,
                message: 'Cannot add to a completed or cancelled goal'
            });
        }

        // Check savings account balance
        const savingsAccount = await Account.findOne({
            userId: req.user.id,
            accountType: 'savings'
        });

        if (savingsAccount.balance < amount) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance in savings account'
            });
        }

        // Update goal
        goal.savedAmount += amount;

        // Auto-complete if target reached
        if (goal.savedAmount >= goal.targetAmount) {
            goal.status = 'completed';
            goal.completedAt = new Date();
        }

        await goal.save();

        res.status(200).json({
            success: true,
            data: goal
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete goal
// @route   DELETE /api/goals/:id
// @access  Private
exports.deleteGoal = async (req, res, next) => {
    try {
        const goal = await Goal.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!goal) {
            return res.status(404).json({
                success: false,
                message: 'Goal not found'
            });
        }

        await goal.deleteOne();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get goals summary
// @route   GET /api/goals/summary
// @access  Private
exports.getGoalsSummary = async (req, res, next) => {
    try {
        const goals = await Goal.find({ userId: req.user.id });

        const summary = {
            total: goals.length,
            active: 0,
            completed: 0,
            cancelled: 0,
            totalTarget: 0,
            totalSaved: 0,
            overallProgress: 0
        };

        goals.forEach(goal => {
            summary[goal.status]++;
            summary.totalTarget += goal.targetAmount;
            summary.totalSaved += goal.savedAmount;
        });

        if (summary.totalTarget > 0) {
            summary.overallProgress = Math.round((summary.totalSaved / summary.totalTarget) * 100);
        }

        res.status(200).json({
            success: true,
            data: summary
        });
    } catch (err) {
        next(err);
    }
};
