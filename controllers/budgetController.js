const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');

// @desc    Get all budgets
// @route   GET /api/budgets
exports.getBudgets = async (req, res, next) => {
    try {
        const { month, year } = req.query;
        let query = { userId: req.user.id };
        if (month && year) {
            query.month = parseInt(month);
            query.year = parseInt(year);
        }
        const budgets = await Budget.find(query).sort({ category: 1 });
        res.status(200).json({ success: true, count: budgets.length, data: budgets });
    } catch (err) { next(err); }
};

// @desc    Create budget
// @route   POST /api/budgets
exports.createBudget = async (req, res, next) => {
    try {
        req.body.userId = req.user.id;
        const now = new Date();
        req.body.month = req.body.month || now.getMonth() + 1;
        req.body.year = req.body.year || now.getFullYear();
        const budget = await Budget.create(req.body);
        res.status(201).json({ success: true, data: budget });
    } catch (err) { next(err); }
};

// @desc    Update budget
// @route   PUT /api/budgets/:id
exports.updateBudget = async (req, res, next) => {
    try {
        let budget = await Budget.findOne({ _id: req.params.id, userId: req.user.id });
        if (!budget) return res.status(404).json({ success: false, message: 'Budget not found' });
        budget = await Budget.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        res.status(200).json({ success: true, data: budget });
    } catch (err) { next(err); }
};

// @desc    Delete budget
// @route   DELETE /api/budgets/:id
exports.deleteBudget = async (req, res, next) => {
    try {
        const budget = await Budget.findOne({ _id: req.params.id, userId: req.user.id });
        if (!budget) return res.status(404).json({ success: false, message: 'Budget not found' });
        await budget.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (err) { next(err); }
};

// @desc    Get budget alerts
// @route   GET /api/budgets/alerts
exports.getBudgetAlerts = async (req, res, next) => {
    try {
        const now = new Date();
        const budgets = await Budget.find({ userId: req.user.id, month: now.getMonth() + 1, year: now.getFullYear() });
        const alerts = budgets.filter(b => b.isNearLimit || b.isOverBudget).map(b => ({
            category: b.category, limit: b.monthlyLimit, spent: b.currentSpent,
            remaining: b.remaining, spentPercent: b.spentPercent, isOverBudget: b.isOverBudget
        }));
        res.status(200).json({ success: true, count: alerts.length, data: alerts });
    } catch (err) { next(err); }
};
