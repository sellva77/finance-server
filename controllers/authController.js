const User = require('../models/User');
const Account = require('../models/Account');
const Category = require('../models/Category');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
    try {
        const { name, email, password, securityQuestion, securityAnswer } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            securityQuestion,
            securityAnswer
        });

        // Create default accounts for the user
        const defaultAccounts = [
            { userId: user._id, accountType: 'salary', accountName: 'Salary Account', description: 'Primary income account' },
            { userId: user._id, accountType: 'expense', accountName: 'Daily Expense Account', description: 'Daily spending account' },
            { userId: user._id, accountType: 'savings', accountName: 'Savings Account', description: 'Personal savings' },
            { userId: user._id, accountType: 'investment', accountName: 'Investment Account', description: 'Investment portfolio' }
        ];

        await Account.insertMany(defaultAccounts);

        // Create default categories
        const defaultCategories = [
            // Income categories
            { userId: user._id, name: 'Salary', type: 'income', icon: '💰', color: '#10b981' },
            { userId: user._id, name: 'Freelance', type: 'income', icon: '💻', color: '#3b82f6' },
            { userId: user._id, name: 'Investment Returns', type: 'income', icon: '📈', color: '#8b5cf6' },
            { userId: user._id, name: 'Gift', type: 'income', icon: '🎁', color: '#f59e0b' },
            { userId: user._id, name: 'Other Income', type: 'income', icon: '💵', color: '#6b7280' },
            // Expense categories
            { userId: user._id, name: 'Food & Dining', type: 'expense', icon: '🍔', color: '#ef4444' },
            { userId: user._id, name: 'Transportation', type: 'expense', icon: '🚗', color: '#f97316' },
            { userId: user._id, name: 'Shopping', type: 'expense', icon: '🛒', color: '#ec4899' },
            { userId: user._id, name: 'Bills & Utilities', type: 'expense', icon: '📱', color: '#14b8a6' },
            { userId: user._id, name: 'Entertainment', type: 'expense', icon: '🎬', color: '#a855f7' },
            { userId: user._id, name: 'Healthcare', type: 'expense', icon: '🏥', color: '#06b6d4' },
            { userId: user._id, name: 'Education', type: 'expense', icon: '📚', color: '#0ea5e9' },
            { userId: user._id, name: 'Rent', type: 'expense', icon: '🏠', color: '#84cc16' },
            { userId: user._id, name: 'Insurance', type: 'expense', icon: '🛡️', color: '#64748b' },
            { userId: user._id, name: 'Personal Care', type: 'expense', icon: '💅', color: '#f472b6' },
            { userId: user._id, name: 'Other Expense', type: 'expense', icon: '📦', color: '#9ca3af' }
        ];

        await Category.insertMany(defaultCategories);

        sendTokenResponse(user, 201, res);
    } catch (err) {
        next(err);
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate email & password
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an email and password'
            });
        }

        // Check for user
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        sendTokenResponse(user, 200, res);
    } catch (err) {
        next(err);
    }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
exports.updateDetails = async (req, res, next) => {
    try {
        const fieldsToUpdate = {
            name: req.body.name,
            email: req.body.email
        };

        const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('+password');

        // Check current password
        if (!(await user.matchPassword(req.body.currentPassword))) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        user.password = req.body.newPassword;
        await user.save();

        sendTokenResponse(user, 200, res);
    } catch (err) {
        next(err);
    }
};

// @desc    Get security question for forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
exports.forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an email'
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No user found with this email'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                securityQuestion: user.securityQuestion
            }
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Reset password using security answer
// @route   POST /api/auth/resetpassword
// @access  Public
exports.resetPassword = async (req, res, next) => {
    try {
        const { email, securityAnswer, newPassword } = req.body;

        if (!email || !securityAnswer || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email, security answer, and new password'
            });
        }

        const user = await User.findOne({ email }).select('+securityAnswer');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No user found with this email'
            });
        }

        // Verify security answer
        const isMatch = await user.matchSecurityAnswer(securityAnswer);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Security answer is incorrect'
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password reset successfully'
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete user account and all data
// @route   DELETE /api/auth/deleteaccount
// @access  Private
exports.deleteAccount = async (req, res, next) => {
    try {
        const { password } = req.body;
        const userId = req.user.id;

        // Verify password
        const user = await User.findById(userId).select('+password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Password is incorrect'
            });
        }

        // Import all models for cleanup
        const Transaction = require('../models/Transaction');
        const Goal = require('../models/Goal');
        const Investment = require('../models/Investment');
        const Budget = require('../models/Budget');
        const Tag = require('../models/Tag');
        const RecurringTransaction = require('../models/RecurringTransaction');
        const Settings = require('../models/Settings');

        // Delete all user data
        await Promise.all([
            Transaction.deleteMany({ userId }),
            Account.deleteMany({ userId }),
            Goal.deleteMany({ userId }),
            Investment.deleteMany({ userId }),
            Budget.deleteMany({ userId }),
            Tag.deleteMany({ userId }),
            RecurringTransaction.deleteMany({ userId }),
            Category.deleteMany({ userId }),
            Settings.deleteMany({ user: userId }),
            User.findByIdAndDelete(userId)
        ]);

        res.status(200).json({
            success: true,
            message: 'Account deleted successfully'
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get data summary (count of all user data)
// @route   GET /api/auth/datasummary
// @access  Private
exports.getDataSummary = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const Transaction = require('../models/Transaction');
        const Goal = require('../models/Goal');
        const Investment = require('../models/Investment');
        const Budget = require('../models/Budget');
        const Tag = require('../models/Tag');
        const RecurringTransaction = require('../models/RecurringTransaction');

        const [
            transactionCount,
            accountCount,
            goalCount,
            investmentCount,
            budgetCount,
            tagCount,
            recurringCount,
            categoryCount
        ] = await Promise.all([
            Transaction.countDocuments({ userId }),
            Account.countDocuments({ userId }),
            Goal.countDocuments({ userId }),
            Investment.countDocuments({ userId }),
            Budget.countDocuments({ userId }),
            Tag.countDocuments({ userId }),
            RecurringTransaction.countDocuments({ userId }),
            Category.countDocuments({ userId })
        ]);

        // Get account creation date
        const user = await User.findById(userId);

        res.status(200).json({
            success: true,
            data: {
                transactions: transactionCount,
                accounts: accountCount,
                goals: goalCount,
                investments: investmentCount,
                budgets: budgetCount,
                tags: tagCount,
                recurringTransactions: recurringCount,
                categories: categoryCount,
                memberSince: user.createdAt
            }
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Clear specific data type
// @route   DELETE /api/auth/cleardata/:type
// @access  Private
exports.clearData = async (req, res, next) => {
    try {
        const { type } = req.params;
        const { password } = req.body;
        const userId = req.user.id;

        // Verify password
        const user = await User.findById(userId).select('+password');
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Password is incorrect'
            });
        }

        const Transaction = require('../models/Transaction');
        const Goal = require('../models/Goal');
        const Investment = require('../models/Investment');
        const Budget = require('../models/Budget');
        const Tag = require('../models/Tag');
        const RecurringTransaction = require('../models/RecurringTransaction');

        let deletedCount = 0;
        let modelName = type;

        switch (type) {
            case 'transactions':
                const txResult = await Transaction.deleteMany({ userId });
                deletedCount = txResult.deletedCount;
                break;
            case 'accounts':
                const accResult = await Account.deleteMany({ userId });
                deletedCount = accResult.deletedCount;
                break;
            case 'goals':
                const goalResult = await Goal.deleteMany({ userId });
                deletedCount = goalResult.deletedCount;
                break;
            case 'investments':
                const invResult = await Investment.deleteMany({ userId });
                deletedCount = invResult.deletedCount;
                break;
            case 'budgets':
                const budgetResult = await Budget.deleteMany({ userId });
                deletedCount = budgetResult.deletedCount;
                break;
            case 'tags':
                const tagResult = await Tag.deleteMany({ userId });
                deletedCount = tagResult.deletedCount;
                break;
            case 'recurring':
                const recResult = await RecurringTransaction.deleteMany({ userId });
                deletedCount = recResult.deletedCount;
                modelName = 'recurring transactions';
                break;
            case 'categories':
                const catResult = await Category.deleteMany({ userId });
                deletedCount = catResult.deletedCount;
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid data type'
                });
        }

        res.status(200).json({
            success: true,
            message: `Deleted ${deletedCount} ${modelName}`,
            deletedCount
        });
    } catch (err) {
        next(err);
    }
};

// Helper function to get token and send response
const sendTokenResponse = (user, statusCode, res) => {
    const token = user.getSignedJwtToken();

    res.status(statusCode).json({
        success: true,
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email
        }
    });
};
