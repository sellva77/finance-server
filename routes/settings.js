const express = require('express');
const router = express.Router();
const { getSettings, updateSettings, getCurrencies } = require('../controllers/settingsController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
    .get(getSettings)
    .put(updateSettings);

router.get('/currencies', getCurrencies);

module.exports = router;
