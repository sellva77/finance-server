const Account = require('../models/Account');

// @desc    Get all accounts for user
// @route   GET /api/accounts
// @access  Private
exports.getAccounts = async (req, res, next) => {
    try {
        // Build query - exclude soft-deleted accounts by default
        let query = { userId: req.user.id, isDeleted: { $ne: true } };
        
        // Optionally include deleted accounts
        if (req.query.includeDeleted === 'true') {
            query = { userId: req.user.id };
        }
        
        const accounts = await Account.find(query);

        // Calculate total balance (only from non-deleted accounts)
        const totalBalance = accounts
            .filter(acc => !acc.isDeleted)
            .reduce((sum, acc) => sum + acc.balance, 0);

        res.status(200).json({
            success: true,
            count: accounts.length,
            totalBalance,
            data: accounts
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get single account
// @route   GET /api/accounts/:id
// @access  Private
exports.getAccount = async (req, res, next) => {
    try {
        const account = await Account.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }

        res.status(200).json({
            success: true,
            data: account
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get account by type
// @route   GET /api/accounts/type/:type
// @access  Private
exports.getAccountByType = async (req, res, next) => {
    try {
        const account = await Account.findOne({
            userId: req.user.id,
            accountType: req.params.type
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }

        res.status(200).json({
            success: true,
            data: account
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Create new account
// @route   POST /api/accounts
// @access  Private
exports.createAccount = async (req, res, next) => {
    try {
        req.body.userId = req.user.id;

        const { accountName, accountType, balance, description, color, icon, currency } = req.body;

        // Validate required fields
        if (!accountName || !accountType) {
            return res.status(400).json({
                success: false,
                message: 'Please provide account name and type'
            });
        }

        const accountData = {
            userId: req.user.id,
            accountName,
            accountType: accountType.toLowerCase(),
            balance: balance || 0,
            description,
            color: color || '#6366f1',
            icon: icon || '💰'
        };

        // Add currency if provided
        if (currency && currency.code) {
            accountData.currency = {
                code: currency.code,
                symbol: currency.symbol || currency.code,
                name: currency.name || currency.code,
                locale: currency.locale || 'en-US'
            };
        }

        const account = await Account.create(accountData);

        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            data: account
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update account
// @route   PUT /api/accounts/:id
// @access  Private
exports.updateAccount = async (req, res, next) => {
    try {
        let account = await Account.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }

        // Only allow updating certain fields
        const allowedUpdates = ['accountName', 'accountType', 'description', 'status', 'color', 'icon', 'balance', 'currency'];
        const updates = {};

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                // Special handling for currency object
                if (field === 'currency' && req.body.currency) {
                    updates.currency = {
                        code: req.body.currency.code,
                        symbol: req.body.currency.symbol || req.body.currency.code,
                        name: req.body.currency.name || req.body.currency.code,
                        locale: req.body.currency.locale || 'en-US'
                    };
                } else {
                    updates[field] = req.body[field];
                }
            }
        });

        account = await Account.findByIdAndUpdate(req.params.id, updates, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: account
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get account summary
// @route   GET /api/accounts/summary
// @access  Private
exports.getAccountSummary = async (req, res, next) => {
    try {
        const accounts = await Account.find({ userId: req.user.id });

        const summary = {
            salary: 0,
            expense: 0,
            savings: 0,
            investment: 0,
            total: 0
        };

        accounts.forEach(account => {
            summary[account.accountType] = account.balance;
            summary.total += account.balance;
        });

        res.status(200).json({
            success: true,
            data: summary
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Soft delete account
// @route   DELETE /api/accounts/:id/soft
// @access  Private
exports.softDeleteAccount = async (req, res, next) => {
    try {
        const account = await Account.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }

        // Check if already deleted
        if (account.isDeleted) {
            return res.status(400).json({
                success: false,
                message: 'Account is already deleted'
            });
        }

        // Check if account has balance
        if (account.balance > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete account with balance. Please transfer the funds first.',
                balance: account.balance,
                requiresTransfer: true
            });
        }

        // Perform soft delete
        account.isDeleted = true;
        account.deletedAt = new Date();
        await account.save();

        res.status(200).json({
            success: true,
            message: 'Account moved to trash successfully',
            data: account
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Permanent delete account
// @route   DELETE /api/accounts/:id/permanent
// @access  Private
exports.permanentDeleteAccount = async (req, res, next) => {
    try {
        const account = await Account.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }

        // Check if account has balance
        if (account.balance > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot permanently delete account with balance. Please transfer the funds first.',
                balance: account.balance,
                requiresTransfer: true
            });
        }

        // Permanently delete account
        await Account.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Account permanently deleted'
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Restore soft-deleted account
// @route   PUT /api/accounts/:id/restore
// @access  Private
exports.restoreAccount = async (req, res, next) => {
    try {
        const account = await Account.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }

        if (!account.isDeleted) {
            return res.status(400).json({
                success: false,
                message: 'Account is not deleted'
            });
        }

        // Restore account
        account.isDeleted = false;
        account.deletedAt = null;
        await account.save();

        res.status(200).json({
            success: true,
            message: 'Account restored successfully',
            data: account
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get deleted accounts
// @route   GET /api/accounts/deleted
// @access  Private
exports.getDeletedAccounts = async (req, res, next) => {
    try {
        const accounts = await Account.find({
            userId: req.user.id,
            isDeleted: true
        });

        res.status(200).json({
            success: true,
            count: accounts.length,
            data: accounts
        });
    } catch (err) {
        next(err);
    }
};
