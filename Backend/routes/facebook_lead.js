const express = require('express');
const router = express.Router();
const facebook_lead = require('../models/facebook_lead');

// POST /facebooklead/Save_Facebook_Lead
// Body: { Lead_ID, name, phone, location, model, date }
router.post('/Save_Facebook_Lead', async (req, res) => {
    try {
        const rows = await facebook_lead.Save_Facebook_Lead(req.body);
        res.json({ success: true, data: rows });
    } catch (e) {
        console.error('Save_Facebook_Lead error:', e);
        res.status(500).json({ success: false, message: 'Failed to save Facebook lead', error: e.message });
    }
});

// GET /facebooklead/Search_Facebook_Lead?search=<term>
router.get('/Search_Facebook_Lead', async (req, res) => {
    try {
        const rows = await facebook_lead.Search_Facebook_Lead(req.query.search || '');
        res.json({ success: true, data: rows });
    } catch (e) {
        console.error('Search_Facebook_Lead error:', e);
        res.status(500).json({ success: false, message: 'Failed to fetch Facebook leads', error: e.message });
    }
});

// DELETE /facebooklead/Delete_Facebook_Lead/:Lead_ID
router.delete('/Delete_Facebook_Lead/:Lead_ID', async (req, res) => {
    try {
        const rows = await facebook_lead.Delete_Facebook_Lead(req.params.Lead_ID);
        res.json({ success: true, data: rows });
    } catch (e) {
        console.error('Delete_Facebook_Lead error:', e);
        res.status(500).json({ success: false, message: 'Failed to delete Facebook lead', error: e.message });
    }
});

module.exports = router;
