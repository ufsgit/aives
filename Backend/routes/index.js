var express = require('express');
var router = express.Router();
const Public = require("../models/Public");
var course = require('../models/course');
var teacher = require('../models/teacher');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.json({ status: "API is running", version: "1.0.0" });
});

/* GET home page. */
router.get('/Get_All_Menu', async function(req, res, next) {
  try {



    const rows = await Public.Get_All_Menu();
    console.log('rows: ', rows);
 


 
    res.json([...rows ]);
} catch (error) { 
    console.error(error);
    res.status(500).json({
        errors: {
            message: "An error occurred while processing your request."
        }
    });
}
 
});

router.get('/Get_All_Menu_Permission', async function(req, res, next) {
  try {



      const rows = await Public.Get_All_Menu_Permission();
      
    console.log('rows: ', rows);
    res.json([...rows ]);
} catch (error) { 
    console.error(error);
    res.status(500).json({
        errors: {
            message: "An error occurred while processing your request."
        }
    });
}
 
});

router.get('/Search_course/', async(req, res, next) => {
    try {
        const rows = await course.Search_course(req.query.course_Name,req.query.priceFrom ,req.query.priceTo);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to search course', error: e.message });
    }
});
router.get('/Check_App_Version/', async(req, res, next) => {
    try {
        const rows = await Public.Check_App_Version(req.query.Version);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to search course', error: e.message });
    }
});
router.post('/deactivate_Account/', async(req, res, next) => {
    try {
        const rows = await Public.deactivate_Account(req.body);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to search course', error: e.message });
    }
});

router.post('/save_recording/', async (req, res, next) => {
    try {
        console.log('Request Body:', req.body);
        if(req.body['detail'] && req.body['detail']['upload_status']==1){
        const fileInfo =req.body['detail']['file_info'][0]
        console.log(fileInfo)
        const extractedPath = fileInfo.file_url.split(".com/")[1];
        const file = {
            LiveClass_Link:req.body['room_id'],
            Record_Class_Link:extractedPath
        }
        console.log(file)
        const rows = await teacher.Update_Record_Class_By_Link(file);
        console.log(rows)
        res.json({ success: true, message: 'Recording saved successfully' ,data:rows });

    }else{
        res.json({ success: false, message: 'Recording not saved Details Empty' });
    }

    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to save recording', error: e.message });
    }
});
router.post('/save_oneToOne_recording/', async (req, res, next) => {
    try {
        console.log('Request Body:', req.body);
        if(req.body['detail'] && req.body['detail']['upload_status']==1){
        const fileInfo =req.body['detail']['file_info'][0]
        console.log(fileInfo)
        const extractedPath = fileInfo.file_url.split(".com/")[1];
        const file = {
            Live_Link:req.body['room_id'],
            Record_Class_Link:extractedPath
        }
        console.log(file)
        const rows = await teacher.Save_OneToOne_Record_By_Link(file);
        console.log(rows)
        res.json({ success: true, message: 'Recording saved successfully' ,data:rows });

    }else{
        res.json({ success: false, message: 'Recording not saved Details Empty' });
    }

    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to save recording', error: e.message });
    }
});

module.exports = router;
 