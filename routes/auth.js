const express = require('express');
const { 
    register, 
    login, 
    getMe, 
    updateDetails, 
    updatePassword,
    forgotPassword,
    resetPassword,
    deleteAccount,
    getDataSummary,
    clearData
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgotpassword', forgotPassword);
router.post('/resetpassword', resetPassword);
router.get('/me', protect, getMe);
router.put('/updatedetails', protect, updateDetails);
router.put('/updatepassword', protect, updatePassword);
router.delete('/deleteaccount', protect, deleteAccount);
router.get('/datasummary', protect, getDataSummary);
router.delete('/cleardata/:type', protect, clearData);

module.exports = router;
