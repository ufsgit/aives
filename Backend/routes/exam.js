const express = require('express');
const router = express.Router();
const Exam=require('../models/exam');

 router.post('/Save_Exam_Questions/', async (req, res, next)=>
 { 
 try 
 { 
  console.log("req.body",req.body);
  console.log("req.body",req.body.Questions[0].Answer_Options);
  
     const rows = await Exam.Save_Exam_Questions(req.body); 
     res.json(rows[0]);
 }
 catch (e) 
 {
     console.log('e: ', e);
     res.status(500).json({ success: false, message: 'Failed to save Batch', error: e.message }); 
 }
 });

 // ✅ Fetch Exams by Course ID (0 = all)
router.get('/Get_Exams_With_Course/:courseId', async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId) || 0;
    const result = await Exam.Get_Exams_With_Course(courseId);
    res.json(result[0]); // Return the first result set
  } catch (e) {
    console.error('Get Exams Error:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch exams', error: e.message });
  }
});
//  Delete_Course
router.post('/Delete_Exam/', async (req, res, next)=>
 { 
 try 
 {  
     const rows = await Exam.Delete_Exam(req.body.Exam_ID); 
     res.json(rows[0]);
 }
 catch (e) 
 {
     console.log('e: ', e);
     res.status(500).json({ success: false, message: 'Failed to save Batch', error: e.message }); 
 }
 });
//  get-questions
router.get('/Get_questions/:examId', async (req, res) => {
  try {

    const examId = parseInt(req.params.examId) || 0;;
    const result = await Exam.Get_questions(examId);
    res.json(result[0]); // Return the first result set
  } catch (e) {
    console.error('Get Exams Error:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch exams', error: e.message });
  }
});
// Question_Details using Exam_ID
router.get('/Get_Exam_Details/:Exam_ID', async (req, res) => {
  try {

    const Exam_ID = parseInt(req.params.Exam_ID) || 0;
    const result = await Exam.Get_Exam_Details(Exam_ID);
    res.json(result[0]); // Return the first result set
  } catch (e) {
    console.error('Get Exams Error:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch exams', error: e.message });
  }
});


module.exports = router;
