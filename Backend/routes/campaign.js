const express = require('express');
const router = express.Router();
const campaign = require('../models/campaign');

router.post('/Save_Campaign/', async (req, res) => {
    try {
        const rows = await campaign.Save_Campaign(req.body);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to save campaign', error: e.message });
    }
});

router.get('/Search_Campaign/', async (req, res) => {
    try {
        const rows = await campaign.Search_Campaign(req.query.Campaign_Name);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to search campaigns', error: e.message });
    }
});

router.get('/Delete_Campaign/:Campaign_ID', async (req, res) => {
    try {
        const rows = await campaign.Delete_Campaign(req.params.Campaign_ID);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to delete campaign', error: e.message });
    }
});

module.exports = router;
