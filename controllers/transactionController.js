const Transaction = require('../models/Transaction');
const TransactionLog = require('../models/TransactionLog');
const Account = require('../models/Account');
const Budget = require('../models/Budget');
const Tag = require('../models/Tag');

// @desc    Get all transactions for user
// @route   GET /api/transactions
// @access  Private
exports.getTransactions = async (req, res, next) => {
    try {
        // Build query
        let query = { userId: req.user.id };

        // Filter by type
        if (req.query.type) {
            query.type = req.query.type;
        }

        // Filter by category
        if (req.query.category) {
            query.category = req.query.category;
        }

        // Filter by tags (supports multiple tags with comma separation)
        if (req.query.tags) {
            const tagIds = req.query.tags.split(',').filter(id => id.trim());
            if (tagIds.length > 0) {
                query.tags = { $in: tagIds };
            }
        }

        // Filter by date range
        if (req.query.startDate || req.query.endDate) {
            query.transactionDate = {};
            if (req.query.startDate) {
                query.transactionDate.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                query.transactionDate.$lte = new Date(req.query.endDate);
            }
        }

        // Filter by month and year
        if (req.query.month && req.query.year) {
            const startDate = new Date(req.query.year, req.query.month - 1, 1);
            const endDate = new Date(req.query.year, req.query.month, 0, 23, 59, 59);
            query.transactionDate = { $gte: startDate, $lte: endDate };
        }

        // Pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 50;
        const startIndex = (page - 1) * limit;

        const total = await Transaction.countDocuments(query);

        const transactions = await Transaction.find(query)
            .populate('fromAccount', 'accountName accountType')
            .populate('toAccount', 'accountName accountType')
            .populate('tags', 'name color icon')
            .sort({ transactionDate: -1, createdAt: -1 })
            .skip(startIndex)
            .limit(limit);

        res.status(200).json({
            success: true,
            count: transactions.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            data: transactions
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get single transaction
// @route   GET /api/transactions/:id
// @access  Private
exports.getTransaction = async (req, res, next) => {
    try {
        const transaction = await Transaction.findOne({
            _id: req.params.id,
            userId: req.user.id
        })
            .populate('fromAccount', 'accountName accountType')
            .populate('toAccount', 'accountName accountType')
            .populate('tags', 'name color icon');

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        // Get modification history if any
        const logs = await TransactionLog.find({ transactionId: req.params.id })
            .sort({ modifiedAt: -1 });

        res.status(200).json({
            success: true,
            data: transaction,
            history: logs
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Create new transaction
// @route   POST /api/transactions
// @access  Private
exports.createTransaction = async (req, res, next) => {
    try {
        req.body.userId = req.user.id;

        // Sanitize account fields - convert empty strings to null
        if (req.body.fromAccount === '' || req.body.fromAccount === undefined) {
            req.body.fromAccount = null;
        }
        if (req.body.toAccount === '' || req.body.toAccount === undefined) {
            req.body.toAccount = null;
        }

        const { type, fromAccount, toAccount, amount, category } = req.body;

        // Validate accounts exist and belong to user
        if (fromAccount) {
            const fromAcc = await Account.findOne({ _id: fromAccount, userId: req.user.id });
            if (!fromAcc) {
                return res.status(404).json({
                    success: false,
                    message: 'Source account not found'
                });
            }
            if (fromAcc.status === 'locked') {
                return res.status(400).json({
                    success: false,
                    message: 'Source account is locked'
                });
            }
        }

        if (toAccount) {
            const toAcc = await Account.findOne({ _id: toAccount, userId: req.user.id });
            if (!toAcc) {
                return res.status(404).json({
                    success: false,
                    message: 'Destination account not found'
                });
            }
        }

        // Create transaction
        const transaction = await Transaction.create(req.body);

        // Update account balances based on transaction type
        if (type === 'income') {
            // Income goes to salary account by default
            await Account.findByIdAndUpdate(toAccount, {
                $inc: { balance: amount }
            });
        } else if (type === 'expense') {
            // Expense comes from expense account
            const expenseAcc = await Account.findById(fromAccount);
            if (expenseAcc.balance < amount) {
                // Rollback transaction
                await Transaction.findByIdAndDelete(transaction._id);
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient balance in expense account'
                });
            }
            await Account.findByIdAndUpdate(fromAccount, {
                $inc: { balance: -amount }
            });

            // Update budget if exists
            const now = new Date();
            await Budget.findOneAndUpdate(
                {
                    userId: req.user.id,
                    category: category,
                    month: now.getMonth() + 1,
                    year: now.getFullYear()
                },
                { $inc: { currentSpent: amount } }
            );
        } else if (type === 'transfer') {
            // Transfer between accounts
            const fromAcc = await Account.findById(fromAccount);
            if (fromAcc.balance < amount) {
                await Transaction.findByIdAndDelete(transaction._id);
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient balance for transfer'
                });
            }
            
            // Deduct from source account (original amount)
            await Account.findByIdAndUpdate(fromAccount, {
                $inc: { balance: -amount }
            });
            
            // Add to destination account
            // If currency conversion is involved, use the converted amount
            const amountToAdd = req.body.convertedAmount || amount;
            await Account.findByIdAndUpdate(toAccount, {
                $inc: { balance: amountToAdd }
            });
        } else if (type === 'investment') {
            // Investment from investment account
            const invAcc = await Account.findById(fromAccount);
            if (invAcc.balance < amount) {
                await Transaction.findByIdAndDelete(transaction._id);
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient balance for investment'
                });
            }
            await Account.findByIdAndUpdate(fromAccount, {
                $inc: { balance: -amount }
            });
        }

        const populatedTransaction = await Transaction.findById(transaction._id)
            .populate('fromAccount', 'accountName accountType')
            .populate('toAccount', 'accountName accountType');

        res.status(201).json({
            success: true,
            data: populatedTransaction
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update transaction (with audit log)
// @route   PUT /api/transactions/:id
// @access  Private
exports.updateTransaction = async (req, res, next) => {
    try {
        let transaction = await Transaction.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        // Require reason for modification
        if (!req.body.reason) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a reason for modification'
            });
        }

        // Store old data for audit log
        const oldData = transaction.toObject();

        // Fields that can be updated
        const allowedUpdates = ['amount', 'category', 'paymentMode', 'note', 'transactionDate', 'tags'];
        const updates = { wasEdited: true };

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        // Handle amount change - adjust account balances
        if (req.body.amount && req.body.amount !== transaction.amount) {
            const difference = req.body.amount - transaction.amount;

            if (transaction.type === 'income') {
                await Account.findByIdAndUpdate(transaction.toAccount, {
                    $inc: { balance: difference }
                });
            } else if (transaction.type === 'expense') {
                const expenseAcc = await Account.findById(transaction.fromAccount);
                if (expenseAcc.balance < difference) {
                    return res.status(400).json({
                        success: false,
                        message: 'Insufficient balance for this update'
                    });
                }
                await Account.findByIdAndUpdate(transaction.fromAccount, {
                    $inc: { balance: -difference }
                });
            }
        }

        // Update transaction
        transaction = await Transaction.findByIdAndUpdate(req.params.id, updates, {
            new: true,
            runValidators: true
        });

        // Create audit log
        await TransactionLog.create({
            transactionId: req.params.id,
            userId: req.user.id,
            oldData,
            newData: transaction.toObject(),
            reason: req.body.reason
        });

        const populatedTransaction = await Transaction.findById(transaction._id)
            .populate('fromAccount', 'accountName accountType')
            .populate('toAccount', 'accountName accountType');

        res.status(200).json({
            success: true,
            message: 'Transaction updated with audit log',
            data: populatedTransaction
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get transaction summary
// @route   GET /api/transactions/summary
// @access  Private
exports.getTransactionSummary = async (req, res, next) => {
    try {
        const { month, year } = req.query;

        let dateMatch = {};
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            dateMatch = {
                transactionDate: { $gte: startDate, $lte: endDate }
            };
        }

        const summary = await Transaction.aggregate([
            {
                $match: {
                    userId: req.user._id,
                    ...dateMatch
                }
            },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        const result = {
            income: { total: 0, count: 0 },
            expense: { total: 0, count: 0 },
            transfer: { total: 0, count: 0 },
            investment: { total: 0, count: 0 }
        };

        summary.forEach(item => {
            result[item._id] = { total: item.total, count: item.count };
        });

        result.netSavings = result.income.total - result.expense.total;

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get category-wise expense breakdown
// @route   GET /api/transactions/category-breakdown
// @access  Private
exports.getCategoryBreakdown = async (req, res, next) => {
    try {
        const { month, year, type = 'expense' } = req.query;

        let dateMatch = {};
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            dateMatch = {
                transactionDate: { $gte: startDate, $lte: endDate }
            };
        }

        const breakdown = await Transaction.aggregate([
            {
                $match: {
                    userId: req.user._id,
                    type: type,
                    ...dateMatch
                }
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { total: -1 }
            }
        ]);

        res.status(200).json({
            success: true,
            data: breakdown
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get comprehensive analytics data
// @route   GET /api/transactions/analytics
// @access  Private
exports.getAnalytics = async (req, res, next) => {
    try {
        const { year, month, category, accountId, type } = req.query;
        const currentYear = year ? parseInt(year) : new Date().getFullYear();
        
        // Build base match query
        const baseMatch = { userId: req.user._id };
        
        // Optional filters
        if (category) baseMatch.category = category;
        if (type) baseMatch.type = type;
        if (accountId) {
            baseMatch.$or = [
                { fromAccount: require('mongoose').Types.ObjectId(accountId) },
                { toAccount: require('mongoose').Types.ObjectId(accountId) }
            ];
        }

        // 1. Get yearly summary (all years)
        const yearlySummary = await Transaction.aggregate([
            { $match: { userId: req.user._id } },
            {
                $group: {
                    _id: {
                        year: { $year: '$transactionDate' },
                        type: '$type'
                    },
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': -1 } }
        ]);

        // 2. Get monthly breakdown for selected year
        const monthlyMatch = { 
            ...baseMatch,
            transactionDate: {
                $gte: new Date(currentYear, 0, 1),
                $lte: new Date(currentYear, 11, 31, 23, 59, 59)
            }
        };
        
        // Remove $or if accountId was set (it conflicts with transactionDate match)
        if (accountId) {
            delete monthlyMatch.$or;
            monthlyMatch.$or = [
                { fromAccount: require('mongoose').Types.ObjectId(accountId) },
                { toAccount: require('mongoose').Types.ObjectId(accountId) }
            ];
        }

        const monthlyBreakdown = await Transaction.aggregate([
            { $match: monthlyMatch },
            {
                $group: {
                    _id: {
                        month: { $month: '$transactionDate' },
                        type: '$type'
                    },
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.month': 1 } }
        ]);

        // 3. Get category breakdown for selected year
        const categoryMatch = { 
            ...baseMatch,
            transactionDate: {
                $gte: new Date(currentYear, 0, 1),
                $lte: new Date(currentYear, 11, 31, 23, 59, 59)
            }
        };
        if (month) {
            categoryMatch.transactionDate = {
                $gte: new Date(currentYear, parseInt(month) - 1, 1),
                $lte: new Date(currentYear, parseInt(month), 0, 23, 59, 59)
            };
        }

        const categoryBreakdown = await Transaction.aggregate([
            { $match: categoryMatch },
            {
                $group: {
                    _id: {
                        category: '$category',
                        type: '$type'
                    },
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { total: -1 } }
        ]);

        // 4. Get daily spending trend for the selected month (or current month)
        const trendMonth = month ? parseInt(month) : new Date().getMonth() + 1;
        const dailyTrend = await Transaction.aggregate([
            {
                $match: {
                    userId: req.user._id,
                    transactionDate: {
                        $gte: new Date(currentYear, trendMonth - 1, 1),
                        $lte: new Date(currentYear, trendMonth, 0, 23, 59, 59)
                    }
                }
            },
            {
                $group: {
                    _id: {
                        day: { $dayOfMonth: '$transactionDate' },
                        type: '$type'
                    },
                    total: { $sum: '$amount' }
                }
            },
            { $sort: { '_id.day': 1 } }
        ]);

        // 5. Get top spending categories
        const topCategories = await Transaction.aggregate([
            {
                $match: {
                    userId: req.user._id,
                    type: 'expense',
                    transactionDate: {
                        $gte: new Date(currentYear, 0, 1),
                        $lte: new Date(currentYear, 11, 31, 23, 59, 59)
                    }
                }
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                    avgAmount: { $avg: '$amount' }
                }
            },
            { $sort: { total: -1 } },
            { $limit: 10 }
        ]);

        // 6. Get all transactions for export (with optional filters)
        let exportMatch = { ...baseMatch };
        if (month) {
            exportMatch.transactionDate = {
                $gte: new Date(currentYear, parseInt(month) - 1, 1),
                $lte: new Date(currentYear, parseInt(month), 0, 23, 59, 59)
            };
        } else {
            exportMatch.transactionDate = {
                $gte: new Date(currentYear, 0, 1),
                $lte: new Date(currentYear, 11, 31, 23, 59, 59)
            };
        }

        const transactionsForExport = await Transaction.find(exportMatch)
            .populate('fromAccount', 'accountName')
            .populate('toAccount', 'accountName')
            .sort({ transactionDate: -1 })
            .limit(1000);

        // 7. Calculate totals
        const yearTotal = {
            income: 0,
            expense: 0,
            savings: 0,
            investment: 0
        };

        monthlyBreakdown.forEach(item => {
            if (item._id.type === 'income') yearTotal.income += item.total;
            if (item._id.type === 'expense') yearTotal.expense += item.total;
            if (item._id.type === 'investment') yearTotal.investment += item.total;
        });
        yearTotal.savings = yearTotal.income - yearTotal.expense;

        // Format monthly data
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formattedMonthly = months.map((name, idx) => {
            const monthData = { month: name, monthNumber: idx + 1, income: 0, expense: 0, savings: 0 };
            monthlyBreakdown.forEach(item => {
                if (item._id.month === idx + 1) {
                    if (item._id.type === 'income') monthData.income = item.total;
                    if (item._id.type === 'expense') monthData.expense = item.total;
                }
            });
            monthData.savings = monthData.income - monthData.expense;
            return monthData;
        });

        // Format yearly data
        const years = [...new Set(yearlySummary.map(y => y._id.year))].sort((a, b) => b - a);
        const formattedYearly = years.map(yr => {
            const yearData = { year: yr, income: 0, expense: 0, savings: 0, investment: 0 };
            yearlySummary.forEach(item => {
                if (item._id.year === yr) {
                    if (item._id.type === 'income') yearData.income = item.total;
                    if (item._id.type === 'expense') yearData.expense = item.total;
                    if (item._id.type === 'investment') yearData.investment = item.total;
                }
            });
            yearData.savings = yearData.income - yearData.expense;
            return yearData;
        });

        res.status(200).json({
            success: true,
            data: {
                selectedYear: currentYear,
                yearTotal,
                yearly: formattedYearly,
                monthly: formattedMonthly,
                categories: categoryBreakdown,
                topCategories,
                dailyTrend,
                transactions: transactionsForExport
            }
        });
    } catch (err) {
        next(err);
    }
};

// NOTE: DELETE operation is intentionally NOT implemented
// Transactions are APPEND-ONLY for lifetime financial logging
// If wrong data is entered, use UPDATE with reason for audit trail
