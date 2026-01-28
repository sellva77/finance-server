const express = require('express');
const {
    getTransactions, getTransaction, createTransaction, updateTransaction,
    getTransactionSummary, getCategoryBreakdown, getAnalytics
} = require('../controllers/transactionController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', getTransactions);
router.get('/summary', getTransactionSummary);
router.get('/category-breakdown', getCategoryBreakdown);
router.get('/analytics', getAnalytics);
router.post('/', createTransaction);
router.get('/:id', getTransaction);
router.put('/:id', updateTransaction);
// NOTE: DELETE is intentionally NOT implemented - transactions are append-only

module.exports = router;
