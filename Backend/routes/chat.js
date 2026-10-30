var express = require('express');
var router = express.Router();
var chat = require('../models/chat');
router.get('/search_chat_history_teacher/:teacher_Id_?', async (req, res, next) => {
    try {
        const rows = await chat.search_chat_history_teacher(req.params.teacher_Id_);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get search_chat_history_teacher', error: e.message });
    }
});
router.get('/Get_Chats_Media/:student_id_?/:teacher_Id_?', async (req, res, next) => {
    try {
        const rows = await chat.Get_Chats_Media(req.params.student_id_,req.params.teacher_Id_);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get Get_Chats_Media', error: e.message });
    }
});

module.exports = router; 