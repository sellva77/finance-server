const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    getInvestments,
    getInvestment,
    createInvestment,
    updateInvestment,
    deleteInvestment,
    addTransaction,
    updateValue,
    getAnalytics,
    calculateXIRR,
    getDividendSummary
} = require('../controllers/investmentController');

// All routes are protected
router.use(protect);

// IMPORTANT: Specific routes MUST come BEFORE parameterized routes (:id)
// Analytics and summary routes - these must be first!
router.get('/analytics', getAnalytics);
router.get('/dividends', getDividendSummary);

// Base CRUD routes
router.route('/')
    .get(getInvestments)
    .post(createInvestment);

// Parameterized routes - these must come AFTER specific routes
router.route('/:id')
    .get(getInvestment)
    .put(updateInvestment)
    .delete(deleteInvestment);

// Sub-routes for specific investment
router.post('/:id/transaction', addTransaction);
router.put('/:id/value', updateValue);
router.get('/:id/xirr', calculateXIRR);

module.exports = router;
