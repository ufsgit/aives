const express = require('express');
const router = express.Router();
const Reports = require('../models/Reports');

// GET: List of users
router.get('/Get_UserList', async (req, res) => {
  try {
    const users = await Reports.Get_UserList();
    res.json(users);
  } catch (err) {
    console.error('Get_UserList Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user list',
      error: err.message
    });
  }
});

// routes/reports.js
router.post('/Search_Receipts_and_Expense', async (req, res) => {
  try {
    console.log("Search_Receipts_and_Expense called with params:", req.body);
    
    const results = await Reports.Search_Receipts_and_Expense(req.body);
    const Expenses = (results && results[1] && results[1][0]) ? results[1][0] : null;
    res.json({ success: true, data: results[0], Expenses :  Expenses});
  } catch (err) {
    console.error('Search_Receipts_and_Expense Error:', err);
    res.status(500).json({ success: false, message: 'Failed to search receipts and expenses' });
  }
});


module.exports = router;
