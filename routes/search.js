const express = require('express');
const {
    searchAll,
    searchTransactions,
    searchAccounts,
    getSearchSuggestions
} = require('../controllers/searchController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/search
// @desc    Global search across all entities
router.get('/', searchAll);

// @route   GET /api/search/transactions
// @desc    Search only transactions
router.get('/transactions', searchTransactions);

// @route   GET /api/search/accounts
// @desc    Search only accounts
router.get('/accounts', searchAccounts);

// @route   GET /api/search/suggestions
// @desc    Get search suggestions (autocomplete)
router.get('/suggestions', getSearchSuggestions);

module.exports = router;
