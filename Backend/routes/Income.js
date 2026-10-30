const express = require('express');
const router = express.Router();
const Income = require('../models/Income');

router.post('/Save_Income_Type', async (req, res) => {
    try {
        const data = req.body;
        const result = await Income.Save_Income_Type(data);
        res.json(result[0]);
    } catch (e) {
        console.error('Save Income Type Error:', e);
        res.status(500).json({ success: false, message: 'Failed to save income type', error: e.message });
    }
});

router.get('/Get_Income_Type', async (req, res) => {
    try {
        const result = await Income.Get_Income_Type();
        res.json(result[0]);
    } catch (e) {
        console.error('Get Income Type Error:', e);
        res.status(500).json({ success: false, message: 'Failed to get income type', error: e.message });
    }
});

router.post('/Delete_Income_Type', async (req, res) => {
    try {
        const { Income_Type_Id } = req.body;
        const result = await Income.Delete_Income_Type(Income_Type_Id);
        res.json(result[0]);
    } catch (e) {
        console.error('Delete Income Type Error:', e);
        res.status(500).json({ success: false, message: 'Failed to delete income type', error: e.message });
    }
});

router.post('/Save_Income_Category', async (req, res) => {
    try {
        const data = req.body;
        const result = await Income.Save_Income_Category(data);
        res.json(result[0]);
    } catch (e) {
        console.error('Save Income Category Error:', e);
        res.status(500).json({ success: false, message: 'Failed to save income category', error: e.message });
    }
});

router.get('/Get_Income_Category', async (req, res) => {
    try {
        const result = await Income.Get_Income_Category();
        res.json(result[0]);
    } catch (e) {
        console.error('Get Income Category Error:', e);
        res.status(500).json({ success: false, message: 'Failed to get income category', error: e.message });
    }
});

router.post('/Delete_Income_Category', async (req, res) => {
    try {
        const { Income_Category_Id } = req.body;
        const result = await Income.Delete_Income_Category(Income_Category_Id);
        res.json(result[0]);
    } catch (e) {
        console.error('Delete Income Category Error:', e);
        res.status(500).json({ success: false, message: 'Failed to delete income category', error: e.message });
    }
});

router.post('/Delete_Income', async (req, res) => {
    try {
        const { Income_Id } = req.body;
        const result = await Income.Delete_Income(Income_Id);
        res.json(result[0]);
    } catch (e) {
        console.error('Delete Income Error:', e);
        res.status(500).json({ success: false, message: 'Failed to delete income', error: e.message });
    }
});

router.post('/Save_Income', async (req, res) => {
    try {
        const data = req.body;
        const result = await Income.Save_Income(data);
        res.json(result[0]);
    } catch (e) {
        console.error('Save Income Error:', e);
        res.status(500).json({ success: false, message: 'Failed to save income', error: e.message });
    }
});

router.get('/Get_IncomeList', async (req, res) => {
    try {
        const { page = 1, pageSize = 10, fromDate, toDate, accountId, expenseTypeId } = req.query;
        const filters = { fromDate, toDate, accountId, expenseTypeId };
        const result = await Income.Get_IncomeList(parseInt(page), parseInt(pageSize), filters);
        res.json(result);
    } catch (e) {
        console.error('Get Income list Error:', e);
        res.status(500).json({ success: false, message: 'Failed to get income list', error: e.message });
    }
});

module.exports = router;
