const express = require('express');
const router = express.Router();
const MockTestPackage = require('../models/mockTestPackage');

router.post('/Save_MockTestPackage', async (req, res) => {
    try {
        const data = req.body;
        const result = await MockTestPackage.Save_MockTestPackage(data);
        res.json({ ReturnCode: 200, ReturnMessage: "Saved successfully", data: result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ReturnCode: 500, ReturnMessage: "Internal Server Error" });
    }
});

router.get('/Get_MockTestPackages', async (req, res) => {
    try {
        const result = await MockTestPackage.Get_MockTestPackages();
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ ReturnCode: 500, ReturnMessage: "Internal Server Error" });
    }
});

router.post('/Delete_MockTestPackage', async (req, res) => {
    try {
        const { Package_ID } = req.body;
        const result = await MockTestPackage.Delete_MockTestPackage(Package_ID);
        res.json({ ReturnCode: 200, ReturnMessage: "Deleted successfully", data: result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ReturnCode: 500, ReturnMessage: "Internal Server Error" });
    }
});

module.exports = router;
