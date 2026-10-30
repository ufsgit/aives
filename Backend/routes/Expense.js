const express = require('express');
const router = express.Router();
const Expense=require('../models/Expense');

// This endpoint saves a new expense type or updates an existing one
router.post('/Save_Expense_Type', async (req, res) => {
    try {
        const data = req.body;
        const result = await Expense.Save_Expense_Type(data);
        res.json(result[0]); // Return the first result set
    } catch (e) {
        console.error('Save Expense Error:', e);
        res.status(500).json({ success: false, message: 'Failed to save expense', error: e.message });
    }
});

// ✅ Fetch all expense types
router.get('/Get_Expense_Type', async (req, res) => {
    try {
        const result = await Expense.Get_Expense();
        res.json(result[0]); // Return the first result set
    } catch (e) {
        console.error('Get Expense Error:', e);
        res.status(500).json({ success: false, message: 'Failed to get expense', error: e.message });
    }
});

// This endpoint deletes an expense type by its ID
router.post('/Delete_Expense_Type', async (req, res) => {
    try {
        const { Expense_Type_Id } = req.body;
        const result = await Expense.Delete_Expense_Type(Expense_Type_Id);
        res.json(result[0]);
    } catch (e) {
        console.error('Delete Expense Error:', e);
        res.status(500).json({ success: false, message: 'Failed to delete expense', error: e.message });
    }
});

// This endpoint saves a new expense category or updates an existing one
router.post('/Save_Expense_Category', async (req, res) => {
    try {
        const data = req.body;
        const result = await Expense.Save_Expense_Category(data);
        res.json(result[0]); // Return the first result set
    } catch (e) {
        console.error('Save Expense Category Error:', e);
        res.status(500).json({ success: false, message: 'Failed to save expense category', error: e.message });
    }
});

// ✅ Fetch all expense category
router.get('/Get_Expense_Category', async (req, res) => {
    try {
        const result = await Expense.Get_Expense_Category();
        res.json(result[0]); // Return the first result set
    } catch (e) {
        console.error('Get Expense category Error:', e);
        res.status(500).json({ success: false, message: 'Failed to get expense category', error: e.message });
    }
});

// This endpoint deletes an expense Category by its ID
router.post('/Delete_Expense_Category', async (req, res) => {
    try {
        const { Expense_Category_Id } = req.body;
        const result = await Expense.Delete_Expense_Category(Expense_Category_Id);
        res.json(result[0]);
    } catch (e) {
        console.error('Delete Expense category Error:', e);
        res.status(500).json({ success: false, message: 'Failed to delete expense category', error: e.message });
    }
});

// Delete_Expense
router.post('/Delete_Expense', async (req, res) => {
    try {
        const { Expense_Id } = req.body;
        const result = await Expense.Delete_Expense(Expense_Id);
        res.json(result[0]);
    } catch (e) {
        console.error('Delete Expense Error:', e);
        res.status(500).json({ success: false, message: 'Failed to delete expense', error: e.message });
    }
});


// Search_Expense_Type
router.post('/Search_Expense_Type', async (req, res) => {
    try {
        console.log("req.body", req.body);
        
        const { Expense_Type_Name } = req.body;
        const result = await Expense.Search_Expense(Expense_Type_Name);
        res.json(result[0]); // Return the first result set
    } catch (e) {
        console.error('Search Expense Error:', e);
        res.status(500).json({ success: false, message: 'Failed to search expense', error: e.message });
    }
});

// Save_Expense
router.post('/Save_Expense', async (req, res) => {
    try {
        const data = req.body;
        const result = await Expense.Save_Expense(data);
        res.json(result[0]); // Return the first result set
    } catch (e) {
        console.error('Save Expense Error:', e);
        res.status(500).json({ success: false, message: 'Failed to save expense', error: e.message });
    }
});

// Get_ExpenseList
router.get('/Get_ExpenseList', async (req, res) => {
    try {
        const { page = 1, pageSize = 10, fromDate, toDate, accountId, expenseTypeId } = req.query;
        const result = await Expense.Get_ExpenseList(parseInt(page), parseInt(pageSize), {
            fromDate,
            toDate,
            accountId,
            expenseTypeId
        });
        res.json(result);
    } catch (e) {
        console.error('Get Expense Error:', e);
        res.status(500).json({ success: false, message: 'Failed to get expense', error: e.message });
    }
});

// Get_Student ExpenseList
router.get('/Get_ExpenseList_Student_ID/:Student_ID', async (req, res) => {
    try {
        const {Student_ID} = req.params
        const result = await Expense.Get_ExpenseList_Student_ID(Student_ID);
        res.json(result[0]); // Return the first result set
    } catch (e) {
        console.error('Get Expense Error:', e);
        res.status(500).json({ success: false, message: 'Failed to get expense', error: e.message });
    }
});

module.exports = router;