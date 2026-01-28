const RecurringTransaction = require('../models/RecurringTransaction');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Budget = require('../models/Budget');

// @desc    Get all recurring transactions
// @route   GET /api/recurring
// @access  Private
exports.getRecurringTransactions = async (req, res, next) => {
    try {
        const { isActive, frequency, type } = req.query;
        const query = { userId: req.user.id };

        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }
        if (frequency) {
            query.frequency = frequency;
        }
        if (type) {
            query.type = type;
        }

        const recurring = await RecurringTransaction.find(query)
            .populate('fromAccount', 'accountName accountType')
            .populate('toAccount', 'accountName accountType')
            .populate('tags', 'name color')
            .sort({ nextRunDate: 1 });

        res.status(200).json({
            success: true,
            count: recurring.length,
            data: recurring
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get single recurring transaction
// @route   GET /api/recurring/:id
// @access  Private
exports.getRecurringTransaction = async (req, res, next) => {
    try {
        const recurring = await RecurringTransaction.findOne({
            _id: req.params.id,
            userId: req.user.id
        })
            .populate('fromAccount', 'accountName accountType')
            .populate('toAccount', 'accountName accountType')
            .populate('tags', 'name color');

        if (!recurring) {
            return res.status(404).json({
                success: false,
                message: 'Recurring transaction not found'
            });
        }

        // Get execution history
        const executions = await Transaction.find({
            userId: req.user.id,
            note: { $regex: `\\[Auto: ${recurring.name}\\]` }
        })
            .sort({ transactionDate: -1 })
            .limit(10);

        res.status(200).json({
            success: true,
            data: recurring,
            executions
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Create recurring transaction
// @route   POST /api/recurring
// @access  Private
exports.createRecurringTransaction = async (req, res, next) => {
    try {
        req.body.userId = req.user.id;

        // Calculate initial next run date
        const startDate = new Date(req.body.startDate || Date.now());
        req.body.nextRunDate = startDate;

        // Sanitize account fields
        if (req.body.fromAccount === '') req.body.fromAccount = null;
        if (req.body.toAccount === '') req.body.toAccount = null;

        const recurring = await RecurringTransaction.create(req.body);

        const populated = await RecurringTransaction.findById(recurring._id)
            .populate('fromAccount', 'accountName accountType')
            .populate('toAccount', 'accountName accountType')
            .populate('tags', 'name color');

        res.status(201).json({
            success: true,
            message: 'Recurring transaction created successfully',
            data: populated
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update recurring transaction
// @route   PUT /api/recurring/:id
// @access  Private
exports.updateRecurringTransaction = async (req, res, next) => {
    try {
        let recurring = await RecurringTransaction.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!recurring) {
            return res.status(404).json({
                success: false,
                message: 'Recurring transaction not found'
            });
        }

        // Sanitize account fields
        if (req.body.fromAccount === '') req.body.fromAccount = null;
        if (req.body.toAccount === '') req.body.toAccount = null;

        recurring = await RecurringTransaction.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        )
            .populate('fromAccount', 'accountName accountType')
            .populate('toAccount', 'accountName accountType')
            .populate('tags', 'name color');

        res.status(200).json({
            success: true,
            message: 'Recurring transaction updated',
            data: recurring
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete recurring transaction
// @route   DELETE /api/recurring/:id
// @access  Private
exports.deleteRecurringTransaction = async (req, res, next) => {
    try {
        const recurring = await RecurringTransaction.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!recurring) {
            return res.status(404).json({
                success: false,
                message: 'Recurring transaction not found'
            });
        }

        await recurring.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Recurring transaction deleted'
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Toggle pause/resume
// @route   PUT /api/recurring/:id/toggle-pause
// @access  Private
exports.togglePause = async (req, res, next) => {
    try {
        const recurring = await RecurringTransaction.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!recurring) {
            return res.status(404).json({
                success: false,
                message: 'Recurring transaction not found'
            });
        }

        recurring.isPaused = !recurring.isPaused;
        await recurring.save();

        res.status(200).json({
            success: true,
            message: recurring.isPaused ? 'Recurring transaction paused' : 'Recurring transaction resumed',
            data: recurring
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Execute recurring transaction now
// @route   POST /api/recurring/:id/execute
// @access  Private
exports.executeNow = async (req, res, next) => {
    try {
        const recurring = await RecurringTransaction.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!recurring) {
            return res.status(404).json({
                success: false,
                message: 'Recurring transaction not found'
            });
        }

        // Create the transaction
        const transactionData = {
            userId: req.user.id,
            type: recurring.type,
            fromAccount: recurring.fromAccount,
            toAccount: recurring.toAccount,
            amount: recurring.amount,
            category: recurring.category,
            paymentMode: recurring.paymentMode,
            note: `[Auto: ${recurring.name}] ${recurring.note || ''}`.trim(),
            transactionDate: new Date(),
            tags: recurring.tags
        };

        // Create transaction
        const transaction = await Transaction.create(transactionData);

        // Update account balances
        if (recurring.type === 'income' && recurring.toAccount) {
            await Account.findByIdAndUpdate(recurring.toAccount, {
                $inc: { balance: recurring.amount }
            });
        } else if (recurring.type === 'expense' && recurring.fromAccount) {
            await Account.findByIdAndUpdate(recurring.fromAccount, {
                $inc: { balance: -recurring.amount }
            });

            // Update budget
            const now = new Date();
            await Budget.findOneAndUpdate(
                {
                    userId: req.user.id,
                    category: recurring.category,
                    month: now.getMonth() + 1,
                    year: now.getFullYear()
                },
                { $inc: { currentSpent: recurring.amount } }
            );
        } else if (recurring.type === 'transfer') {
            await Account.findByIdAndUpdate(recurring.fromAccount, {
                $inc: { balance: -recurring.amount }
            });
            await Account.findByIdAndUpdate(recurring.toAccount, {
                $inc: { balance: recurring.amount }
            });
        }

        // Update recurring transaction
        recurring.lastRunDate = new Date();
        recurring.nextRunDate = recurring.calculateNextRunDate();
        recurring.totalExecutions += 1;

        // Check if max executions reached
        if (recurring.maxExecutions && recurring.totalExecutions >= recurring.maxExecutions) {
            recurring.isActive = false;
        }

        await recurring.save();

        const populatedTransaction = await Transaction.findById(transaction._id)
            .populate('fromAccount', 'accountName')
            .populate('toAccount', 'accountName');

        res.status(201).json({
            success: true,
            message: 'Recurring transaction executed successfully',
            transaction: populatedTransaction,
            recurring: recurring
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Get upcoming scheduled transactions
// @route   GET /api/recurring/upcoming
// @access  Private
exports.getUpcoming = async (req, res, next) => {
    try {
        const { days = 30 } = req.query;
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + parseInt(days));

        const upcoming = await RecurringTransaction.find({
            userId: req.user.id,
            isActive: true,
            isPaused: false,
            nextRunDate: { $lte: futureDate }
        })
            .populate('fromAccount', 'accountName')
            .populate('toAccount', 'accountName')
            .sort({ nextRunDate: 1 });

        // Group by date
        const grouped = {};
        upcoming.forEach(item => {
            const dateKey = item.nextRunDate.toISOString().split('T')[0];
            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            grouped[dateKey].push(item);
        });

        res.status(200).json({
            success: true,
            count: upcoming.length,
            data: upcoming,
            grouped
        });
    } catch (err) {
        next(err);
    }
};
