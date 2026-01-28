const Investment = require('../models/Investment');
const Account = require('../models/Account');
const mongoose = require('mongoose');

// Helper to validate ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// @desc    Get all investments for user
// @route   GET /api/investments
// @access  Private
exports.getInvestments = async (req, res, next) => {
    try {
        const { status, type, accountId } = req.query;
        const filter = { userId: req.user.id };

        if (status && status !== 'all') {
            filter.status = status;
        }
        if (type && type !== 'all') {
            filter.type = type;
        }
        if (accountId) {
            filter.accountId = accountId;
        }

        const investments = await Investment.find(filter)
            .populate('accountId', 'accountName icon color currency')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: investments.length,
            data: investments
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single investment
// @route   GET /api/investments/:id
// @access  Private
exports.getInvestment = async (req, res, next) => {
    try {
        // Validate ObjectId to prevent cast errors
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid investment ID'
            });
        }

        const investment = await Investment.findOne({
            _id: req.params.id,
            userId: req.user.id
        }).populate('accountId', 'accountName icon color currency');

        if (!investment) {
            return res.status(404).json({
                success: false,
                message: 'Investment not found'
            });
        }

        res.status(200).json({
            success: true,
            data: investment
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create investment
// @route   POST /api/investments
// @access  Private
exports.createInvestment = async (req, res, next) => {
    try {
        req.body.userId = req.user.id;

        // Set currentValue to investedAmount if not provided
        if (!req.body.currentValue && req.body.investedAmount) {
            req.body.currentValue = req.body.investedAmount;
        }

        // Calculate currentPrice from units if applicable
        if (req.body.units && req.body.currentValue && !req.body.currentPrice) {
            req.body.currentPrice = req.body.currentValue / req.body.units;
        }

        // Create initial buy transaction for history
        const initialTransaction = {
            type: 'buy',
            date: req.body.purchaseDate || new Date(),
            units: req.body.units || 0,
            pricePerUnit: req.body.buyPrice || 0,
            amount: req.body.investedAmount || 0,
            notes: 'Initial purchase'
        };

        req.body.transactions = [initialTransaction];

        // Create initial value history entry
        req.body.valueHistory = [{
            date: req.body.purchaseDate || new Date(),
            value: req.body.currentValue || req.body.investedAmount || 0,
            units: req.body.units || 0
        }];

        const investment = await Investment.create(req.body);

        res.status(201).json({
            success: true,
            data: investment
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update investment
// @route   PUT /api/investments/:id
// @access  Private
exports.updateInvestment = async (req, res, next) => {
    try {
        let investment = await Investment.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!investment) {
            return res.status(404).json({
                success: false,
                message: 'Investment not found'
            });
        }

        // If currentValue changed, add to value history
        if (req.body.currentValue && req.body.currentValue !== investment.currentValue) {
            investment.valueHistory.push({
                date: new Date(),
                value: req.body.currentValue,
                units: req.body.units || investment.units
            });
        }

        // Update fields
        Object.assign(investment, req.body);
        investment.lastUpdated = new Date();

        await investment.save();

        res.status(200).json({
            success: true,
            data: investment
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete investment
// @route   DELETE /api/investments/:id
// @access  Private
exports.deleteInvestment = async (req, res, next) => {
    try {
        const investment = await Investment.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!investment) {
            return res.status(404).json({
                success: false,
                message: 'Investment not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Add transaction to investment (buy more, sell, dividend)
// @route   POST /api/investments/:id/transaction
// @access  Private
exports.addTransaction = async (req, res, next) => {
    try {
        const investment = await Investment.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!investment) {
            return res.status(404).json({
                success: false,
                message: 'Investment not found'
            });
        }

        const { type, date, units, pricePerUnit, amount, notes } = req.body;

        const transaction = {
            type,
            date: date || new Date(),
            units: units || 0,
            pricePerUnit: pricePerUnit || 0,
            amount: amount || 0,
            notes
        };

        investment.transactions.push(transaction);

        // Update investment based on transaction type
        switch (type) {
            case 'buy':
                investment.investedAmount += amount;
                investment.units += units || 0;
                // Recalculate average buy price
                if (investment.units > 0) {
                    investment.buyPrice = investment.investedAmount / investment.units;
                }
                break;

            case 'sell':
                investment.units -= units || 0;
                if (investment.units <= 0) {
                    investment.status = 'sold';
                    investment.soldDate = date || new Date();
                    investment.soldAmount = investment.currentValue + amount;
                } else {
                    investment.status = 'partial_sold';
                }
                // Update current value proportionally
                if (investment.units > 0 && investment.currentPrice > 0) {
                    investment.currentValue = investment.units * investment.currentPrice;
                }
                break;

            case 'dividend':
                investment.totalDividendsReceived += amount;
                investment.lastDividendDate = date || new Date();
                investment.lastDividendAmount = amount;
                investment.dividendEnabled = true;
                break;

            case 'split':
            case 'bonus':
                investment.units += units || 0;
                // Adjust buy price after split/bonus
                if (investment.units > 0) {
                    investment.buyPrice = investment.investedAmount / investment.units;
                }
                break;
        }

        investment.lastUpdated = new Date();
        await investment.save();

        res.status(200).json({
            success: true,
            data: investment
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update current value (for tracking)
// @route   PUT /api/investments/:id/value
// @access  Private
exports.updateValue = async (req, res, next) => {
    try {
        const investment = await Investment.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!investment) {
            return res.status(404).json({
                success: false,
                message: 'Investment not found'
            });
        }

        const { currentValue, currentPrice } = req.body;

        // Add to value history
        investment.valueHistory.push({
            date: new Date(),
            value: currentValue,
            units: investment.units
        });

        investment.currentValue = currentValue;
        if (currentPrice) {
            investment.currentPrice = currentPrice;
        } else if (investment.units > 0) {
            investment.currentPrice = currentValue / investment.units;
        }

        investment.lastUpdated = new Date();
        await investment.save();

        res.status(200).json({
            success: true,
            data: investment
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get portfolio analytics
// @route   GET /api/investments/analytics
// @access  Private
exports.getAnalytics = async (req, res, next) => {
    try {
        const investments = await Investment.find({
            userId: req.user.id,
            status: { $in: ['active', 'partial_sold'] }
        }).populate('accountId', 'accountName currency');

        // Portfolio totals
        let totalInvested = 0;
        let totalCurrentValue = 0;
        let totalDividends = 0;

        // Allocation by type
        const allocationByType = {};

        // Allocation by status
        const statusBreakdown = { active: 0, partial_sold: 0, sold: 0, matured: 0 };

        // Top performers and losers
        const performanceData = [];

        investments.forEach(inv => {
            totalInvested += inv.investedAmount || 0;
            totalCurrentValue += inv.currentValue || 0;
            totalDividends += inv.totalDividendsReceived || 0;

            // Allocation by type
            if (!allocationByType[inv.type]) {
                allocationByType[inv.type] = {
                    type: inv.type,
                    invested: 0,
                    currentValue: 0,
                    count: 0
                };
            }
            allocationByType[inv.type].invested += inv.investedAmount || 0;
            allocationByType[inv.type].currentValue += inv.currentValue || 0;
            allocationByType[inv.type].count += 1;

            // Status breakdown
            if (statusBreakdown[inv.status] !== undefined) {
                statusBreakdown[inv.status] += inv.currentValue || 0;
            }

            // Performance tracking
            performanceData.push({
                id: inv._id,
                name: inv.name,
                type: inv.type,
                invested: inv.investedAmount,
                currentValue: inv.currentValue,
                profitLoss: inv.profitLoss,
                profitLossPercent: inv.profitLossPercent,
                cagr: inv.cagr,
                daysHeld: inv.daysHeld
            });
        });

        // Sort for top performers and losers
        const sortedByReturn = [...performanceData].sort((a, b) => b.profitLossPercent - a.profitLossPercent);
        const topPerformers = sortedByReturn.slice(0, 5);
        const bottomPerformers = sortedByReturn.slice(-5).reverse();

        // Calculate allocation percentages
        const allocationArray = Object.values(allocationByType).map(item => ({
            ...item,
            percentage: totalCurrentValue > 0 ? (item.currentValue / totalCurrentValue * 100) : 0,
            profitLoss: item.currentValue - item.invested,
            profitLossPercent: item.invested > 0 ? ((item.currentValue - item.invested) / item.invested * 100) : 0
        }));

        // Calculate portfolio XIRR (simplified - using overall return)
        const overallProfitLoss = totalCurrentValue + totalDividends - totalInvested;
        const overallReturnPercent = totalInvested > 0 ? (overallProfitLoss / totalInvested * 100) : 0;

        // Get upcoming maturities (next 90 days)
        const upcomingMaturities = await Investment.find({
            userId: req.user.id,
            status: 'active',
            maturityDate: {
                $gte: new Date(),
                $lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
            }
        }).sort({ maturityDate: 1 }).limit(10);

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalInvested,
                    totalCurrentValue,
                    totalDividends,
                    totalProfitLoss: overallProfitLoss,
                    overallReturnPercent,
                    totalInvestments: investments.length
                },
                allocation: allocationArray,
                topPerformers,
                bottomPerformers,
                statusBreakdown,
                upcomingMaturities
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Calculate XIRR for an investment
// @route   GET /api/investments/:id/xirr
// @access  Private
exports.calculateXIRR = async (req, res, next) => {
    try {
        const investment = await Investment.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!investment) {
            return res.status(404).json({
                success: false,
                message: 'Investment not found'
            });
        }

        // Build cash flows from transactions
        const cashFlows = [];
        const dates = [];

        investment.transactions.forEach(txn => {
            let amount = 0;
            switch (txn.type) {
                case 'buy':
                    amount = -txn.amount; // Outflow
                    break;
                case 'sell':
                case 'dividend':
                    amount = txn.amount; // Inflow
                    break;
            }
            if (amount !== 0) {
                cashFlows.push(amount);
                dates.push(new Date(txn.date));
            }
        });

        // Add current value as final inflow (if not sold)
        if (investment.status !== 'sold') {
            cashFlows.push(investment.currentValue);
            dates.push(new Date());
        }

        // Calculate XIRR using Newton-Raphson method
        const xirr = calculateXIRRValue(cashFlows, dates);

        res.status(200).json({
            success: true,
            data: {
                xirr: xirr * 100, // Convert to percentage
                cashFlows: cashFlows.map((cf, i) => ({
                    amount: cf,
                    date: dates[i]
                })),
                cagr: investment.cagr,
                absoluteReturn: investment.absoluteReturn
            }
        });
    } catch (error) {
        next(error);
    }
};

// Helper function to calculate XIRR using Newton-Raphson method
function calculateXIRRValue(cashFlows, dates) {
    if (cashFlows.length < 2) return 0;

    // Convert dates to years from first date
    const firstDate = dates[0];
    const years = dates.map(d => (d - firstDate) / (365 * 24 * 60 * 60 * 1000));

    // Newton-Raphson iteration
    let guess = 0.1; // Initial guess: 10%
    const maxIterations = 100;
    const tolerance = 0.0001;

    for (let i = 0; i < maxIterations; i++) {
        let npv = 0;
        let dnpv = 0;

        for (let j = 0; j < cashFlows.length; j++) {
            const pv = cashFlows[j] / Math.pow(1 + guess, years[j]);
            npv += pv;
            dnpv -= years[j] * pv / (1 + guess);
        }

        const newGuess = guess - npv / dnpv;

        if (Math.abs(newGuess - guess) < tolerance) {
            return newGuess;
        }

        guess = newGuess;

        // Prevent divergence
        if (guess < -0.99) guess = -0.99;
        if (guess > 10) guess = 10;
    }

    return guess;
}

// @desc    Get dividend summary
// @route   GET /api/investments/dividends
// @access  Private
exports.getDividendSummary = async (req, res, next) => {
    try {
        const investments = await Investment.find({
            userId: req.user.id,
            dividendEnabled: true
        }).select('name type totalDividendsReceived lastDividendDate lastDividendAmount dividendFrequency currentValue');

        const totalDividends = investments.reduce((sum, inv) => sum + (inv.totalDividendsReceived || 0), 0);

        // Group dividends by month (last 12 months)
        const monthlyDividends = [];
        for (let i = 11; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlyDividends.push({
                month: monthKey,
                label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                amount: 0 // Would need transaction history to calculate accurately
            });
        }

        res.status(200).json({
            success: true,
            data: {
                totalDividends,
                dividendInvestments: investments,
                monthlyDividends
            }
        });
    } catch (error) {
        next(error);
    }
};
