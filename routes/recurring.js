const express = require('express');
const {
    getRecurringTransactions,
    getRecurringTransaction,
    createRecurringTransaction,
    updateRecurringTransaction,
    deleteRecurringTransaction,
    togglePause,
    executeNow,
    getUpcoming
} = require('../controllers/recurringController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/recurring
// @desc    Get all recurring transactions
router.get('/', getRecurringTransactions);

// @route   GET /api/recurring/upcoming
// @desc    Get upcoming scheduled transactions
router.get('/upcoming', getUpcoming);

// @route   POST /api/recurring
// @desc    Create recurring transaction
router.post('/', createRecurringTransaction);

// @route   GET /api/recurring/:id
// @desc    Get single recurring transaction
router.get('/:id', getRecurringTransaction);

// @route   PUT /api/recurring/:id
// @desc    Update recurring transaction
router.put('/:id', updateRecurringTransaction);

// @route   DELETE /api/recurring/:id
// @desc    Delete recurring transaction
router.delete('/:id', deleteRecurringTransaction);

// @route   PUT /api/recurring/:id/toggle-pause
// @desc    Pause/Resume recurring transaction
router.put('/:id/toggle-pause', togglePause);

// @route   POST /api/recurring/:id/execute
// @desc    Execute recurring transaction now
router.post('/:id/execute', executeNow);

module.exports = router;
