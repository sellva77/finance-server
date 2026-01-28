const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    getTags,
    getTag,
    createTag,
    updateTag,
    deleteTag,
    getTagAnalytics,
    getPopularTags
} = require('../controllers/tagController');

// All routes are protected
router.use(protect);

// Specific routes must come before parameterized routes
router.get('/analytics', getTagAnalytics);
router.get('/popular', getPopularTags);

// Standard CRUD routes
router.route('/')
    .get(getTags)
    .post(createTag);

router.route('/:id')
    .get(getTag)
    .put(updateTag)
    .delete(deleteTag);

module.exports = router;
