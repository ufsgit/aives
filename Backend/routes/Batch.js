 var express = require('express');
 var router = express.Router();
 var Batch=require('../models/Batch');
 router.post('/Save_Batch/', async (req, res, next)=>
 { 
 try 
 {
     const rows = await Batch.Save_Batch(req.body); 
     res.json(rows);
 }
 catch (e) 
 {
     console.log('e: ', e);
     res.status(500).json({ success: false, message: 'Failed to save Batch', error: e.message }); 
 }
 });
 router.get('/Search_Batch/', async (req, res, next)=>
 { 
 try 
 {
     const rows = await Batch.Search_Batch(req.query.Batch_Name);
     res.json(rows);
 }
 catch (e) 
 {
     res.status(500).json({ success: false, message: 'Failed to search Batch', error: e.message }); 
 }
 });
 router.get('/Get_Batch/:Batch_Id_?', async (req, res, next)=>
 { 
 try 
 {
     const rows = await Batch.Get_Batch(req.params.Batch_Id_);
     res.json([rows]);
 }
 catch (e) 
 {
     res.status(500).json({ success: false, message: 'Failed to get Batch', error: e.message }); 
 }
 });
 router.get('/Delete_Batch/:Batch_Id_?', async (req, res, next)=>
 { 
 try 
 {
     const rows = await Batch.Delete_Batch(req.params.Batch_Id_);
     res.json(rows);
 }
 catch (e) 
 {
     res.status(500).json({ success: false, message: 'Failed to delete Batch', error: e.message }); 
 }
 });
 router.put('/ChangeStatus/', async (req, res, next)=>
 { 
 try 
 {
     const rows = await Batch.ChangeStatus(req.body); 
     res.json(rows);
 }
 catch (e) 
 {
     res.status(500).json({ success: false, message: 'Failed to change status', error: e.message }); 
 }
 });

 router.get('/Get_Batch_Details/:Batch_Id_?', async (req, res, next)=>
    { 
    try 
    {
        const rows = await Batch.Get_Batch_Details(req.params.Batch_Id_);
        res.json([rows]);
    }
    catch (e) 
    {
        res.status(500).json({ success: false, message: 'Failed to get Batch', error: e.message }); 
    }
    });

    router.get('/Get_Batch_Days/:Course_Id?/:Module_ID', async (req, res, next) => {
        try {
            const rows = await Batch.Get_Batch_Days(req.userId , req.params.Course_Id,req.params.Module_ID);
            res.json(rows);
        }
        catch (e) {
            console.log('e: ', e);
            res.status(500).json({ success: false, message: 'Failed to get Get_Batch_Days', error: e.message });
        }
    });
    router.get('/Get_Exam_Days/:Course_Id?', async (req, res, next) => {
        try {
            const rows = await Batch.Get_Exam_Days(req.userId , req.params.Course_Id);
            res.json(rows);
        }
        catch (e) {
            console.log('e: ', e);
            res.status(500).json({ success: false, message: 'Failed to get Get_Batch_Days', error: e.message });
        }
    });
  module.exports = router;

  