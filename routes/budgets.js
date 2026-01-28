const express = require('express');
const { getBudgets, createBudget, updateBudget, deleteBudget, getBudgetAlerts } = require('../controllers/budgetController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', getBudgets);
router.get('/alerts', getBudgetAlerts);
router.post('/', createBudget);
router.put('/:id', updateBudget);
router.delete('/:id', deleteBudget);

module.exports = router;
