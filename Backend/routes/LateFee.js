
const express = require('express');
const router = express.Router();
const LateFee = require('../models/LateFee');

router.get('/Get_Late_Fee_Amount', async (req, res) => {
    try {
        const amount = await LateFee.Get_Late_Fee_Amount();
        res.json({ success: true, amount: amount });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve late fee amount', error: error.message });
    }
});

module.exports = router;
