 var express = require('express');
 var router = express.Router();
 var course_module=require('../models/course_module');
 router.post('/Save_course_module/', async (req, res, next)=>
 { 
 try 
 {
     const rows = await course_module.Save_course_module(req.body); 
     res.json(rows);
 }
 catch (e) 
 {
     res.status(500).json({ success: false, message: 'Failed to save course_module', error: e.message }); 
 }
 });
 router.get('/Search_course_module/', async (req, res, next)=>
 { 
 try 
 {
     const rows = await course_module.Search_course_module(req.query.course_module_Name,req.query.allModule);
     res.json(rows);
 }
 catch (e) 
 {
     res.status(500).json({ success: false, message: 'Failed to search course_module', error: e.message }); 
 }
 });
 router.get('/Get_course_module/:course_module_Id_?', async (req, res, next)=>
 { 
 try 
 {
     const rows = await course_module.Get_course_module(req.params.course_module_Id_);
     res.json([rows]);
 }
 catch (e) 
 {
     res.status(500).json({ success: false, message: 'Failed to get course_module', error: e.message }); 
 }
 });
 router.get('/Delete_course_module/:course_module_Id_?', async (req, res, next)=>
 { 
 try 
 {
     const rows = await course_module.Delete_course_module(req.params.course_module_Id_);
     res.json(rows);
 }
 catch (e) 
 {
     res.status(500).json({ success: false, message: 'Failed to delete course_module', error: e.message }); 
 }
 });
 router.post('/Change_Module_Status/', async (req, res, next)=>
 { 
 try 
 {
     const rows = await course_module.Change_Module_Status(req.body); 
     res.json(rows);
 }
 catch (e) 
 {
     res.status(500).json({ success: false, message: 'Failed to change status', error: e.message }); 
 }
 });
 router.post('/Change_Student_Module_Lock_Status/', async (req, res, next)=>
    { 
    try 
    {
        const rows = await course_module.Change_Student_Module_Lock_Status(req.body); 
        res.json(rows);
    }
    catch (e) 
    {
        res.status(500).json({ success: false, message: 'Failed to change status', error: e.message }); 
    }
    });
 router.post('/Change_Module_Order/', async (req, res, next)=>
    { 
    try 
    {
        const rows = await course_module.Change_Module_Order(req.body); 
        res.json(rows);
    }
    catch (e) 
    {
        res.status(500).json({ success: false, message: 'Failed to change status', error: e.message }); 
    }
    });

  module.exports = router;

  