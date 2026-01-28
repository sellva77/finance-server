const express = require('express');
const { getGoals, getGoal, createGoal, updateGoal, deleteGoal, addToGoal, getGoalsSummary } = require('../controllers/goalController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', getGoals);
router.get('/summary', getGoalsSummary);
router.post('/', createGoal);
router.get('/:id', getGoal);
router.put('/:id', updateGoal);
router.put('/:id/add', addToGoal);
router.delete('/:id', deleteGoal);

module.exports = router;
