 var express = require('express');
 var router = express.Router();
 var course_category=require('../models/course_category');
 router.post('/Save_course_category/', async (req, res, next)=>
 { 
 try 
 {
     const rows = await course_category.Save_course_category(req.body); 
     res.json(rows);
 }
 catch (e) 
 {
     res.status(500).json({ success: false, message: 'Failed to save course_category', error: e.message }); 
 }
 });
 router.get('/Search_course_category/', async (req, res, next)=>
 { 
 try 
 {
     const rows = await course_category.Search_course_category(req.query.course_category_Name,req.query.allCategory);
     res.json(rows);
 }
 catch (e) 
 {
     res.status(500).json({ success: false, message: 'Failed to search course_category', error: e.message }); 
 }
 });
 router.get('/Get_course_category/:course_category_Id_?', async (req, res, next)=>
 { 
 try 
 {
     const rows = await course_category.Get_course_category(req.params.course_category_Id_);
     res.json([rows]);
 }
 catch (e) 
 {
     res.status(500).json({ success: false, message: 'Failed to get course_category', error: e.message }); 
 }
 });
 router.get('/Delete_course_category/:course_category_Id_?', async (req, res, next)=>
 { 
 try 
 {
     const rows = await course_category.Delete_course_category(req.params.course_category_Id_);
     res.json(rows);
 }
 catch (e) 
 {
     res.status(500).json({ success: false, message: 'Failed to delete course_category', error: e.message }); 
 }
 });
 router.put('/ChangeStatus/', async (req, res, next)=>
 { 
 try 
 {
     const rows = await course_category.ChangeStatus(req.body); 
     res.json(rows);
 }
 catch (e) 
 {
     res.status(500).json({ success: false, message: 'Failed to change status', error: e.message }); 
 }
 });
  module.exports = router;

  