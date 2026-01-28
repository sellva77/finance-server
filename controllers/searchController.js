const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Category = require('../models/Category');
const Goal = require('../models/Goal');
const Investment = require('../models/Investment');
const Tag = require('../models/Tag');

// @desc    Global search across all entities
// @route   GET /api/search?q=query
// @access  Private
exports.searchAll = async (req, res, next) => {
    try {
        const { q, limit = 10 } = req.query;

        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Search query must be at least 2 characters'
            });
        }

        const searchRegex = new RegExp(q.trim(), 'i');
        const userId = req.user.id;

        // Search in parallel for better performance
        const [transactions, accounts, categories, goals, investments, tags] = await Promise.all([
            // Transactions - search in note, category
            Transaction.find({
                userId,
                $or: [
                    { note: searchRegex },
                    { category: searchRegex }
                ]
            })
                .populate('fromAccount', 'accountName')
                .populate('toAccount', 'accountName')
                .populate('tags', 'name color')
                .sort({ transactionDate: -1 })
                .limit(parseInt(limit)),

            // Accounts - search by name
            Account.find({
                userId,
                accountName: searchRegex
            })
                .sort({ balance: -1 })
                .limit(parseInt(limit)),

            // Categories - search by name
            Category.find({
                userId,
                name: searchRegex
            })
                .limit(parseInt(limit)),

            // Goals - search by name, description
            Goal.find({
                userId,
                $or: [
                    { name: searchRegex },
                    { description: searchRegex }
                ]
            })
                .limit(parseInt(limit)),

            // Investments - search by name, symbol
            Investment.find({
                userId,
                $or: [
                    { name: searchRegex },
                    { symbol: searchRegex },
                    { notes: searchRegex }
                ]
            })
                .limit(parseInt(limit)),

            // Tags - search by name
            Tag.find({
                userId,
                name: searchRegex
            })
                .limit(parseInt(limit))
        ]);

        // Calculate total results
        const totalResults = transactions.length + accounts.length + 
                            categories.length + goals.length + 
                            investments.length + tags.length;

        res.status(200).json({
            success: true,
            query: q,
            totalResults,
            data: {
                transactions: {
                    count: transactions.length,
                    items: transactions
                },
                accounts: {
                    count: accounts.length,
                    items: accounts
                },
                categories: {
                    count: categories.length,
                    items: categories
                },
                goals: {
                    count: goals.length,
                    items: goals
                },
                investments: {
                    count: investments.length,
                    items: investments
                },
                tags: {
                    count: tags.length,
                    items: tags
                }
            }
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Search transactions with advanced filters
// @route   GET /api/search/transactions
// @access  Private
exports.searchTransactions = async (req, res, next) => {
    try {
        const {
            q,
            type,
            category,
            minAmount,
            maxAmount,
            startDate,
            endDate,
            accountId,
            tags,
            page = 1,
            limit = 20
        } = req.query;

        const query = { userId: req.user.id };

        // Text search
        if (q && q.trim().length >= 2) {
            const searchRegex = new RegExp(q.trim(), 'i');
            query.$or = [
                { note: searchRegex },
                { category: searchRegex }
            ];
        }

        // Type filter
        if (type) {
            query.type = type;
        }

        // Category filter
        if (category) {
            query.category = new RegExp(category, 'i');
        }

        // Amount range
        if (minAmount || maxAmount) {
            query.amount = {};
            if (minAmount) query.amount.$gte = parseFloat(minAmount);
            if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
        }

        // Date range
        if (startDate || endDate) {
            query.transactionDate = {};
            if (startDate) query.transactionDate.$gte = new Date(startDate);
            if (endDate) query.transactionDate.$lte = new Date(endDate);
        }

        // Account filter
        if (accountId) {
            query.$or = [
                { fromAccount: accountId },
                { toAccount: accountId }
            ];
        }

        // Tags filter
        if (tags) {
            const tagIds = tags.split(',').filter(id => id.trim());
            if (tagIds.length > 0) {
                query.tags = { $in: tagIds };
            }
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Transaction.countDocuments(query);

        const transactions = await Transaction.find(query)
            .populate('fromAccount', 'accountName accountType currency')
            .populate('toAccount', 'accountName accountType currency')
            .populate('tags', 'name color icon')
            .sort({ transactionDate: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            count: transactions.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: transactions
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Search accounts
// @route   GET /api/search/accounts
// @access  Private
exports.searchAccounts = async (req, res, next) => {
    try {
        const { q, type, status, currency } = req.query;

        const query = { userId: req.user.id };

        if (q && q.trim().length >= 2) {
            query.accountName = new RegExp(q.trim(), 'i');
        }

        if (type) {
            query.accountType = type;
        }

        if (status) {
            query.status = status;
        }

        if (currency) {
            query.currency = currency.toUpperCase();
        }

        const accounts = await Account.find(query)
            .sort({ balance: -1 });

        res.status(200).json({
            success: true,
            count: accounts.length,
            data: accounts
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get search suggestions (autocomplete)
// @route   GET /api/search/suggestions?q=query
// @access  Private
exports.getSearchSuggestions = async (req, res, next) => {
    try {
        const { q, limit = 5 } = req.query;

        if (!q || q.trim().length < 1) {
            return res.status(200).json({
                success: true,
                suggestions: []
            });
        }

        const searchRegex = new RegExp('^' + q.trim(), 'i');
        const userId = req.user.id;

        // Get suggestions from different sources
        const [categories, accountNames, tagNames] = await Promise.all([
            // Unique categories
            Transaction.distinct('category', {
                userId,
                category: searchRegex
            }),

            // Account names
            Account.find({
                userId,
                accountName: searchRegex
            })
                .select('accountName')
                .limit(parseInt(limit))
                .then(accounts => accounts.map(a => a.accountName)),

            // Tag names
            Tag.find({
                userId,
                name: searchRegex
            })
                .select('name')
                .limit(parseInt(limit))
                .then(tags => tags.map(t => t.name))
        ]);

        // Combine and dedupe suggestions
        const allSuggestions = [...new Set([
            ...categories.slice(0, 5),
            ...accountNames,
            ...tagNames
        ])].slice(0, parseInt(limit) * 2);

        res.status(200).json({
            success: true,
            query: q,
            suggestions: allSuggestions
        });
    } catch (err) {
        next(err);
    }
};
