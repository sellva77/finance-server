const express = require('express');
const {
    exportTransactionsCSV,
    exportTransactionsJSON,
    exportAccountsCSV,
    exportFullBackup,
    generatePDFReport,
    importBackup
} = require('../controllers/exportController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/export/transactions/csv
// @desc    Export transactions as CSV
router.get('/transactions/csv', exportTransactionsCSV);

// @route   GET /api/export/transactions/json
// @desc    Export transactions as JSON
router.get('/transactions/json', exportTransactionsJSON);

// @route   GET /api/export/accounts/csv
// @desc    Export accounts as CSV
router.get('/accounts/csv', exportAccountsCSV);

// @route   GET /api/export/backup
// @desc    Full data backup (JSON)
router.get('/backup', exportFullBackup);

// @route   GET /api/export/report/pdf
// @desc    Generate PDF report (monthly/yearly summary)
router.get('/report/pdf', generatePDFReport);

// @route   POST /api/export/import
// @desc    Import data from backup file
router.post('/import', importBackup);

module.exports = router;
