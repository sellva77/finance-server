const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Goal = require('../models/Goal');
const Investment = require('../models/Investment');
const Budget = require('../models/Budget');
const Tag = require('../models/Tag');
const RecurringTransaction = require('../models/RecurringTransaction');

// Helper to convert data to CSV
const toCSV = (data, headers) => {
    if (!data || data.length === 0) return '';
    
    const headerRow = headers.join(',');
    const rows = data.map(item => {
        return headers.map(header => {
            let value = item[header];
            if (value === null || value === undefined) return '';
            if (typeof value === 'object') {
                if (value.accountName) return value.accountName;
                if (value._id) return value._id.toString();
                if (Array.isArray(value)) return value.map(v => v.name || v).join(';');
                return JSON.stringify(value);
            }
            // Escape quotes and wrap in quotes if contains comma
            value = String(value);
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                value = '"' + value.replace(/"/g, '""') + '"';
            }
            return value;
        }).join(',');
    });
    
    return headerRow + '\n' + rows.join('\n');
};

// @desc    Export transactions as CSV
// @route   GET /api/export/transactions/csv
// @access  Private
exports.exportTransactionsCSV = async (req, res, next) => {
    try {
        const { startDate, endDate, type, year, month } = req.query;
        
        const query = { userId: req.user.id };
        
        // Date filters
        if (startDate || endDate) {
            query.transactionDate = {};
            if (startDate) query.transactionDate.$gte = new Date(startDate);
            if (endDate) query.transactionDate.$lte = new Date(endDate);
        } else if (year) {
            const y = parseInt(year);
            const m = month ? parseInt(month) - 1 : 0;
            if (month) {
                query.transactionDate = {
                    $gte: new Date(y, m, 1),
                    $lte: new Date(y, m + 1, 0, 23, 59, 59)
                };
            } else {
                query.transactionDate = {
                    $gte: new Date(y, 0, 1),
                    $lte: new Date(y, 11, 31, 23, 59, 59)
                };
            }
        }
        
        if (type) query.type = type;
        
        const transactions = await Transaction.find(query)
            .populate('fromAccount', 'accountName')
            .populate('toAccount', 'accountName')
            .populate('tags', 'name')
            .sort({ transactionDate: -1 })
            .lean();
        
        // Format for CSV
        const formattedData = transactions.map(t => ({
            date: t.transactionDate ? new Date(t.transactionDate).toISOString().split('T')[0] : '',
            type: t.type,
            category: t.category,
            amount: t.amount,
            fromAccount: t.fromAccount?.accountName || '',
            toAccount: t.toAccount?.accountName || '',
            paymentMode: t.paymentMode,
            note: t.note || '',
            tags: t.tags?.map(tag => tag.name).join(';') || ''
        }));
        
        const headers = ['date', 'type', 'category', 'amount', 'fromAccount', 'toAccount', 'paymentMode', 'note', 'tags'];
        const csv = toCSV(formattedData, headers);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=transactions_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    } catch (err) {
        next(err);
    }
};

// @desc    Export transactions as JSON
// @route   GET /api/export/transactions/json
// @access  Private
exports.exportTransactionsJSON = async (req, res, next) => {
    try {
        const { startDate, endDate, type, year } = req.query;
        
        const query = { userId: req.user.id };
        
        if (startDate || endDate) {
            query.transactionDate = {};
            if (startDate) query.transactionDate.$gte = new Date(startDate);
            if (endDate) query.transactionDate.$lte = new Date(endDate);
        } else if (year) {
            query.transactionDate = {
                $gte: new Date(parseInt(year), 0, 1),
                $lte: new Date(parseInt(year), 11, 31, 23, 59, 59)
            };
        }
        
        if (type) query.type = type;
        
        const transactions = await Transaction.find(query)
            .populate('fromAccount', 'accountName accountType')
            .populate('toAccount', 'accountName accountType')
            .populate('tags', 'name color')
            .sort({ transactionDate: -1 })
            .lean();
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=transactions_${new Date().toISOString().split('T')[0]}.json`);
        res.json({
            exportDate: new Date(),
            count: transactions.length,
            transactions
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Export accounts as CSV
// @route   GET /api/export/accounts/csv
// @access  Private
exports.exportAccountsCSV = async (req, res, next) => {
    try {
        const accounts = await Account.find({ userId: req.user.id })
            .sort({ balance: -1 })
            .lean();
        
        const formattedData = accounts.map(a => ({
            accountName: a.accountName,
            accountType: a.accountType,
            balance: a.balance,
            currency: a.currency,
            status: a.status,
            createdAt: a.createdAt ? new Date(a.createdAt).toISOString().split('T')[0] : ''
        }));
        
        const headers = ['accountName', 'accountType', 'balance', 'currency', 'status', 'createdAt'];
        const csv = toCSV(formattedData, headers);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=accounts_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    } catch (err) {
        next(err);
    }
};

// @desc    Full data backup (JSON)
// @route   GET /api/export/backup
// @access  Private
exports.exportFullBackup = async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        // Fetch all user data in parallel
        const [
            accounts,
            transactions,
            goals,
            investments,
            budgets,
            tags,
            recurringTransactions
        ] = await Promise.all([
            Account.find({ userId }).lean(),
            Transaction.find({ userId })
                .populate('fromAccount', 'accountName')
                .populate('toAccount', 'accountName')
                .populate('tags', 'name color')
                .lean(),
            Goal.find({ userId }).lean(),
            Investment.find({ userId }).lean(),
            Budget.find({ userId }).lean(),
            Tag.find({ userId }).lean(),
            RecurringTransaction.find({ userId }).lean()
        ]);
        
        const backup = {
            exportDate: new Date(),
            version: '2.0.0',
            user: {
                id: userId,
                name: req.user.name,
                email: req.user.email
            },
            summary: {
                accounts: accounts.length,
                transactions: transactions.length,
                goals: goals.length,
                investments: investments.length,
                budgets: budgets.length,
                tags: tags.length,
                recurringTransactions: recurringTransactions.length
            },
            data: {
                accounts,
                transactions,
                goals,
                investments,
                budgets,
                tags,
                recurringTransactions
            }
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=finance_backup_${new Date().toISOString().split('T')[0]}.json`);
        res.json(backup);
    } catch (err) {
        next(err);
    }
};

// @desc    Generate PDF-like text report
// @route   GET /api/export/report/pdf
// @access  Private
exports.generatePDFReport = async (req, res, next) => {
    try {
        const { year, month } = req.query;
        const currentYear = year ? parseInt(year) : new Date().getFullYear();
        const userId = req.user.id;
        
        let dateMatch = {
            $gte: new Date(currentYear, 0, 1),
            $lte: new Date(currentYear, 11, 31, 23, 59, 59)
        };
        
        if (month) {
            const m = parseInt(month) - 1;
            dateMatch = {
                $gte: new Date(currentYear, m, 1),
                $lte: new Date(currentYear, m + 1, 0, 23, 59, 59)
            };
        }
        
        // Get summary data
        const [summary, categoryBreakdown, accounts, topTransactions] = await Promise.all([
            // Income/Expense summary
            Transaction.aggregate([
                {
                    $match: {
                        userId: req.user._id,
                        transactionDate: dateMatch
                    }
                },
                {
                    $group: {
                        _id: '$type',
                        total: { $sum: '$amount' },
                        count: { $sum: 1 }
                    }
                }
            ]),
            
            // Category breakdown
            Transaction.aggregate([
                {
                    $match: {
                        userId: req.user._id,
                        type: 'expense',
                        transactionDate: dateMatch
                    }
                },
                {
                    $group: {
                        _id: '$category',
                        total: { $sum: '$amount' },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { total: -1 } },
                { $limit: 10 }
            ]),
            
            // Account balances
            Account.find({ userId }).select('accountName balance currency').lean(),
            
            // Top transactions
            Transaction.find({
                userId,
                transactionDate: dateMatch
            })
                .sort({ amount: -1 })
                .limit(10)
                .lean()
        ]);
        
        // Format summary
        const formattedSummary = {
            income: { total: 0, count: 0 },
            expense: { total: 0, count: 0 },
            transfer: { total: 0, count: 0 },
            investment: { total: 0, count: 0 }
        };
        
        summary.forEach(item => {
            formattedSummary[item._id] = { total: item.total, count: item.count };
        });
        
        formattedSummary.netSavings = formattedSummary.income.total - formattedSummary.expense.total;
        formattedSummary.savingsRate = formattedSummary.income.total > 0 
            ? ((formattedSummary.netSavings / formattedSummary.income.total) * 100).toFixed(1)
            : 0;
        
        // Calculate total balance
        const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
        
        // Build report
        const report = {
            title: month 
                ? `Financial Report - ${new Date(currentYear, parseInt(month) - 1).toLocaleString('default', { month: 'long' })} ${currentYear}`
                : `Financial Report - ${currentYear}`,
            generatedAt: new Date(),
            period: {
                year: currentYear,
                month: month ? parseInt(month) : null
            },
            summary: formattedSummary,
            accounts: {
                list: accounts,
                totalBalance
            },
            topExpenseCategories: categoryBreakdown,
            topTransactions: topTransactions.map(t => ({
                date: t.transactionDate,
                type: t.type,
                category: t.category,
                amount: t.amount,
                note: t.note
            })),
            insights: generateInsights(formattedSummary, categoryBreakdown)
        };
        
        res.status(200).json({
            success: true,
            data: report
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Import data from backup
// @route   POST /api/export/import
// @access  Private
exports.importBackup = async (req, res, next) => {
    try {
        const { data, mode = 'merge' } = req.body;
        const userId = req.user.id;
        
        if (!data) {
            return res.status(400).json({
                success: false,
                error: 'No data provided for import'
            });
        }
        
        const results = {
            accounts: { imported: 0, skipped: 0, errors: [] },
            transactions: { imported: 0, skipped: 0, errors: [] },
            goals: { imported: 0, skipped: 0, errors: [] },
            investments: { imported: 0, skipped: 0, errors: [] },
            budgets: { imported: 0, skipped: 0, errors: [] },
            tags: { imported: 0, skipped: 0, errors: [] },
            recurringTransactions: { imported: 0, skipped: 0, errors: [] }
        };
        
        // ID mapping for references
        const idMap = {
            accounts: {},
            tags: {}
        };
        
        // If replace mode, clear existing data first
        if (mode === 'replace') {
            await Promise.all([
                Transaction.deleteMany({ userId }),
                Account.deleteMany({ userId }),
                Goal.deleteMany({ userId }),
                Investment.deleteMany({ userId }),
                Budget.deleteMany({ userId }),
                Tag.deleteMany({ userId }),
                RecurringTransaction.deleteMany({ userId })
            ]);
        }
        
        // Import Tags first (needed for transaction references)
        if (data.tags && Array.isArray(data.tags)) {
            for (const tag of data.tags) {
                try {
                    const oldId = tag._id;
                    delete tag._id;
                    delete tag.__v;
                    tag.userId = userId;
                    
                    // Check for existing tag with same name
                    const existingTag = await Tag.findOne({ userId, name: tag.name });
                    if (existingTag) {
                        idMap.tags[oldId] = existingTag._id;
                        results.tags.skipped++;
                    } else {
                        const newTag = await Tag.create(tag);
                        idMap.tags[oldId] = newTag._id;
                        results.tags.imported++;
                    }
                } catch (err) {
                    results.tags.errors.push({ name: tag.name, error: err.message });
                }
            }
        }
        
        // Import Accounts
        if (data.accounts && Array.isArray(data.accounts)) {
            for (const account of data.accounts) {
                try {
                    const oldId = account._id;
                    delete account._id;
                    delete account.__v;
                    account.userId = userId;
                    
                    // Check for existing account with same name
                    const existingAccount = await Account.findOne({ userId, accountName: account.accountName });
                    if (existingAccount) {
                        idMap.accounts[oldId] = existingAccount._id;
                        results.accounts.skipped++;
                    } else {
                        const newAccount = await Account.create(account);
                        idMap.accounts[oldId] = newAccount._id;
                        results.accounts.imported++;
                    }
                } catch (err) {
                    results.accounts.errors.push({ name: account.accountName, error: err.message });
                }
            }
        }
        
        // Import Transactions
        if (data.transactions && Array.isArray(data.transactions)) {
            for (const transaction of data.transactions) {
                try {
                    delete transaction._id;
                    delete transaction.__v;
                    transaction.userId = userId;
                    
                    // Map account references
                    if (transaction.fromAccount) {
                        const oldFromId = typeof transaction.fromAccount === 'object' 
                            ? transaction.fromAccount._id 
                            : transaction.fromAccount;
                        transaction.fromAccount = idMap.accounts[oldFromId] || null;
                    }
                    if (transaction.toAccount) {
                        const oldToId = typeof transaction.toAccount === 'object' 
                            ? transaction.toAccount._id 
                            : transaction.toAccount;
                        transaction.toAccount = idMap.accounts[oldToId] || null;
                    }
                    
                    // Map tag references
                    if (transaction.tags && Array.isArray(transaction.tags)) {
                        transaction.tags = transaction.tags.map(tag => {
                            const oldTagId = typeof tag === 'object' ? tag._id : tag;
                            return idMap.tags[oldTagId];
                        }).filter(Boolean);
                    }
                    
                    await Transaction.create(transaction);
                    results.transactions.imported++;
                } catch (err) {
                    results.transactions.errors.push({ 
                        date: transaction.transactionDate, 
                        amount: transaction.amount,
                        error: err.message 
                    });
                }
            }
        }
        
        // Import Goals
        if (data.goals && Array.isArray(data.goals)) {
            for (const goal of data.goals) {
                try {
                    delete goal._id;
                    delete goal.__v;
                    goal.userId = userId;
                    
                    await Goal.create(goal);
                    results.goals.imported++;
                } catch (err) {
                    results.goals.errors.push({ name: goal.name, error: err.message });
                }
            }
        }
        
        // Import Investments
        if (data.investments && Array.isArray(data.investments)) {
            for (const investment of data.investments) {
                try {
                    delete investment._id;
                    delete investment.__v;
                    investment.userId = userId;
                    
                    await Investment.create(investment);
                    results.investments.imported++;
                } catch (err) {
                    results.investments.errors.push({ name: investment.name, error: err.message });
                }
            }
        }
        
        // Import Budgets
        if (data.budgets && Array.isArray(data.budgets)) {
            for (const budget of data.budgets) {
                try {
                    delete budget._id;
                    delete budget.__v;
                    budget.userId = userId;
                    
                    await Budget.create(budget);
                    results.budgets.imported++;
                } catch (err) {
                    results.budgets.errors.push({ category: budget.category, error: err.message });
                }
            }
        }
        
        // Import Recurring Transactions
        if (data.recurringTransactions && Array.isArray(data.recurringTransactions)) {
            for (const recurring of data.recurringTransactions) {
                try {
                    delete recurring._id;
                    delete recurring.__v;
                    recurring.userId = userId;
                    
                    // Map account references
                    if (recurring.fromAccount) {
                        const oldFromId = typeof recurring.fromAccount === 'object' 
                            ? recurring.fromAccount._id 
                            : recurring.fromAccount;
                        recurring.fromAccount = idMap.accounts[oldFromId] || null;
                    }
                    if (recurring.toAccount) {
                        const oldToId = typeof recurring.toAccount === 'object' 
                            ? recurring.toAccount._id 
                            : recurring.toAccount;
                        recurring.toAccount = idMap.accounts[oldToId] || null;
                    }
                    
                    await RecurringTransaction.create(recurring);
                    results.recurringTransactions.imported++;
                } catch (err) {
                    results.recurringTransactions.errors.push({ name: recurring.description, error: err.message });
                }
            }
        }
        
        // Calculate totals
        const totalImported = Object.values(results).reduce((sum, r) => sum + r.imported, 0);
        const totalSkipped = Object.values(results).reduce((sum, r) => sum + r.skipped, 0);
        const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors.length, 0);
        
        res.status(200).json({
            success: true,
            message: `Import completed: ${totalImported} items imported, ${totalSkipped} skipped, ${totalErrors} errors`,
            data: results
        });
    } catch (err) {
        next(err);
    }
};

// Generate financial insights
function generateInsights(summary, categories) {
    const insights = [];
    
    // Savings rate insight
    if (summary.savingsRate >= 20) {
        insights.push({
            type: 'success',
            icon: '🎉',
            message: `Great job! Your savings rate is ${summary.savingsRate}%, above the recommended 20%.`
        });
    } else if (summary.savingsRate >= 10) {
        insights.push({
            type: 'warning',
            icon: '📊',
            message: `Your savings rate is ${summary.savingsRate}%. Try to increase it to 20% for better financial health.`
        });
    } else if (summary.savingsRate > 0) {
        insights.push({
            type: 'alert',
            icon: '⚠️',
            message: `Your savings rate is only ${summary.savingsRate}%. Consider reducing expenses.`
        });
    } else {
        insights.push({
            type: 'danger',
            icon: '🚨',
            message: 'You are spending more than you earn! Review your expenses immediately.'
        });
    }
    
    // Top spending category
    if (categories.length > 0) {
        const topCategory = categories[0];
        const percentage = summary.expense.total > 0 
            ? ((topCategory.total / summary.expense.total) * 100).toFixed(1)
            : 0;
        
        insights.push({
            type: 'info',
            icon: '📈',
            message: `Your highest spending category is "${topCategory._id}" at ₹${topCategory.total.toLocaleString()} (${percentage}% of expenses).`
        });
    }
    
    // Investment insight
    if (summary.investment.total > 0) {
        const investmentRate = ((summary.investment.total / summary.income.total) * 100).toFixed(1);
        insights.push({
            type: 'info',
            icon: '💰',
            message: `You invested ${investmentRate}% of your income. Keep building your wealth!`
        });
    }
    
    return insights;
}
