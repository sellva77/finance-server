const express = require('express');
const { 
    getAccounts, 
    getAccount, 
    getAccountByType, 
    createAccount, 
    updateAccount, 
    getAccountSummary,
    softDeleteAccount,
    permanentDeleteAccount,
    restoreAccount,
    getDeletedAccounts
} = require('../controllers/accountController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', getAccounts);
router.post('/', createAccount);
router.get('/summary', getAccountSummary);
router.get('/deleted', getDeletedAccounts);
router.get('/type/:type', getAccountByType);
router.get('/:id', getAccount);
router.put('/:id', updateAccount);
router.put('/:id/restore', restoreAccount);
router.delete('/:id/soft', softDeleteAccount);
router.delete('/:id/permanent', permanentDeleteAccount);

module.exports = router;

