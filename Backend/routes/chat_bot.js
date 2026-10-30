var express = require('express');
var router = express.Router();
var teacher = require('../models/teacher');
router.get('/Get_Teacher_courses/:teacher_Id_?', async (req, res, next) => {
    try {
        console.log('req: ', req);
        const rows = await teacher.Get_Teacher_courses(req.params.teacher_Id_);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});

router.get('/Get_liveClass/:teacher_Id_?', async (req, res, next) => {
    try {
        const rows = await teacher.Get_liveClass(req.params.teacher_Id_);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get live classes', error: e.message });
    }
});


module.exports = router;