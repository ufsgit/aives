 var express = require('express');
 var router = express.Router();
 var teacher = require('../models/teacher');
 const {subscribeToTopic,sendNotifToTopic} = require('../helpers/firebase');

 var course = require('../models/course');
 router.post('/Save_course/', async(req, res, next) => {
     try {
         console.log('req.body: ', req.body); 
         const rows = await course.Save_course(req.body);
         res.json([rows]);
     } catch (e) {
         console.log(' e.message: ',  e.message);
         res.status(500).json({ success: false, message:  e.message, error: e.message });
     }
 });
  router.post('/saveCourseFees/', async (req, res, next) => { 
          try {
              const result = await course.saveCourseFees(req.body); 
              console.log('Saved User Data:', result);
      
              res.json({message:"fees updated "});
          } catch (error) {
              res.status(500).json({ success: false, message: error.message, error: error.message }); 
          }
      });
    //   deleteInstallmentInformation
    router.post('/deleteInstallmentInformation/', async (req, res, next) => { 
          try {
              const result = await course.deleteInstallmentInformation(req.body); 
              console.log('Saved User Data:', result);
      
              res.json({message:"fees updated "});
          } catch (error) {
              res.status(500).json({ success: false, message: error.message, error: error.message }); 
          }
      });
 router.post('/save_course_content/', async(req, res, next) => {
     try {
         const rows = await course.save_course_content(req.body);
         res.json([rows]);
     } catch (e) {
         console.log(' e.message: ',  e.message);
         res.status(500).json({ success: false, message:  e.message, error: e.message });
     }
 });
 router.post('/Student_Batch_Change/', async(req, res, next) => {
     try {
         console.log('req.body: ', req.body); 
         const rows = await course.Student_Batch_Change(req.body);
         res.json([rows]);
     } catch (e) {
         console.log(' e.message: ',  e.message);
         res.status(500).json({ success: false, message: 'Failed to save course', error: e.message });
     }
 });
 router.post('/ValidateTimeSlots/', async(req, res, next) => {
     try {
         console.log('req.body: ', req.body); 
         const rows = await course.ValidateTimeSlots(req.body);
         res.json({success: true,rows});
     } catch (e) { 
         console.log(' e.message: ',  e.message);
         res.status(200).json({ success: false, error: e.message });
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
 router.get('/Search_all_course/', async(req, res, next) => {
     try {
         const rows = await course.Search_all_course(req.query.course_Name,req.query.priceFrom ,req.query.priceTo);
         res.json(rows);
     } catch (e) {
         res.status(500).json({ success: false, message: 'Failed to search all course', error: e.message });
     }
 });
 router.get('/get_course_names/', async(req, res, next) => {
     try {
         const rows = await course.get_course_names();
         res.json(rows);
     } catch (e) {
         res.status(500).json({ success: false, message: 'Failed to search course', error: e.message });
     }
 });
 router.get('/get_course_fees/:id?', async (req, res, next) => {
    try {
        // Read optional course ID from route param, default to 0
        const courseId = parseInt(req.params.id) || 0;

        const rows = await course.get_course_fees(courseId);
        res.json(rows);
    } catch (e) {
        res.status(500).json({
            success: false,
            message: 'Failed to get course fees',
            error: e.message
        });
    }
});
// Get_InstallmentsByCourseID
router.get('/Get_InstallmentsByCourseID/:courseId', async (req, res, next) => {
    try {
        // Read optional course ID from route param, default to 0
        const { courseId } = req.params;

        const rows = await course.Get_InstallmentsByCourseID(courseId);
        res.json(rows[0]);
    } catch (e) {
        res.status(500).json({
            success: false,
            message: 'Failed to get course fees',
            error: e.message
        });
    }
});
// Get_InstallmentsByFee_Type
router.get('/Get_InstallmentsByFee_Type/:courseId/:Fee_Type/:Batch_ID', async (req, res, next) => {
    try {
        // Read optional course ID from route param, default to 0
        const { courseId,Fee_Type, Batch_ID } = req.params;
console.log(courseId,Fee_Type, Batch_ID);

        const rows = await course.Get_InstallmentsByFee_Type(courseId,Fee_Type, Batch_ID);
        console.log('rows',rows);
        
        res.json(rows[0]);
    } catch (e) {
        console.log(e);
        
        res.status(500).json({
            success: false,
            message: 'Failed to get course fees',
            error: e.message
        });
    }
});
 router.get('/Get_All_Course_Items/', async(req, res, next) => {
     try {
         const rows = await course.Get_All_Course_Items();
         res.json(rows);
     } catch (e) {
         res.status(500).json({ success: false, message: 'Failed to search course', error: e.message });
     }
 });
 router.get('/Get_all_Batch/', async(req, res, next) => {
     try {
         const rows = await course.Get_all_Batch();
         res.json(rows);
     } catch (e) {
         res.status(500).json({ success: false, message: 'Failed to search course', error: e.message });
     }
 });
 router.get('/Get_course/:course_Id_?', async(req, res, next) => {
     try {
         const rows = await course.Get_course(req.params.course_Id_);
         res.json(rows);
     } catch (e) {
         res.status(500).json({ success: false, message: 'Failed to get course', error: e.message });
     }
 });
 router.get('/Get_course_content/:course_Id_?/:contentId?', async(req, res, next) => {
     try {
         const rows = await course.Get_course_content(req.params.course_Id_,req.params.contentId);
         res.json(rows[0][0]);
     } catch (e) {
         res.status(500).json({ success: false, message: 'Failed to get course', error: e.message });
     }
 });
 router.get('/Get_Available_Time_Slot/:course_Id_?', async(req, res, next) => {
     try {
         const rows = await course.Get_Available_Time_Slot(req.params.course_Id_);
         res.json(rows);
     } catch (e) {
         res.status(500).json({ success: false, message: 'Failed to get course', error: e.message });
     }
 });
 router.get('/Get_All_Time_Slot/:course_Id_?', async(req, res, next) => {
     try {
         const rows = await course.Get_All_Time_Slot(req.params.course_Id_);
         res.json(rows);
     } catch (e) {
         res.status(500).json({ success: false, message: 'Failed to get course', error: e.message });
     }
 });

 router.get('/Get_Free_Time_Slot/:course_Id_?', async(req, res, next) => {
    try {
        const rows = await course.Get_Free_Time_Slot(req.params.course_Id_);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get course', error: e.message });
    }
});

 router.get('/Delete_course/:course_Id_?', async(req, res, next) => {
     try {
         const rows = await course.Delete_course(req.params.course_Id_);
         res.json([rows]);
     } catch (e) {
         res.status(500).json({ success: false, message: 'Failed to delete course', error: e.message });
     }
 });
 router.get('/Get_Course_Students/:course_Id_?', async (req, res, next) => {
    try {
        const rows = await course.Get_Course_Students(req.params.course_Id_);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get students', error: e.message });
    }
});
 router.get('/Get_Specific_Exam_Details/:examID?', async (req, res, next) => {
    try {
        const rows = await course.Get_Specific_Exam_Details(req.params.examID);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get students', error: e.message });
    }
});
router.get('/Get_Course_Reviews', async (req, res) => {
    const { studentId, courseId } = req.query;

  
    try {
      const reviews = await course.Get_Course_Reviews(studentId, courseId);
      res.json(reviews);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  router.post('/review_course', async (req, res) => {
    try {
        console.log('req.body: ', req.body);
        const [results, fields] = await course.review_course(req.body);
        console.log('results: ', results);
      
        if (results.message.startsWith('Error')) {
            return res.status(400).json({ error: results });
        } else {
            return res.status(200).json({ message: results });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/Update_LastAccessed_Content', async (req, res) => {
    try {
      const { studentId, courseId, contentId } = req.body;
  
      // Call the model function to update last accessed content
      await course.Update_LastAccessed_Content(studentId, courseId, contentId);
  
      res.status(200).json({ message: 'Last accessed content updated successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while updating last accessed content' });
    }
  });
router.post('/Unlock_Exam', async (req, res) => {
    try {
      const {  contentId,examID, Is_Question_Unlocked,Is_Question_Media_Unlocked,Is_Answer_Unlocked } = req.body;
      console.log('req.body: ', req.body);
  
      // Call the model function to update last accessed content
      const rows =  await course.Unlock_Exam( contentId,examID,Is_Question_Unlocked,Is_Question_Media_Unlocked,req.body.Batch_ID,Is_Answer_Unlocked?Is_Answer_Unlocked:0);
      const studentsList = await teacher.Get_Batch_StudentList(req.body.Batch_ID);
      console.log('studentsList: ', studentsList);


    //   const deviceIds = studentsList
    //   .map(student => student.Device_ID)
    //   .filter(deviceId => deviceId !== null);
    //        console.log('deviceIds: ', deviceIds);
    //       let token = deviceIds;

    if(Is_Question_Unlocked || Is_Question_Media_Unlocked){

     let data={
                      type: 'Exam_Unlocked',
                      callId: '12345',
                      click_action: "FLUTTER_NOTIFICATION_CLICK" // Action to handle click in the client app
                  }
      try {
        const title = "Exam Available";
        const body = "Your Exam Class Has Been Unlocked";
        const notificationResults = await sendNotificationsToMultipleDevices(studentsList, title, body, data);
        console.log('Notification results:', notificationResults);          
          console.log('rows: ', rows);
          res.status(200).json({ rows });
        } catch (error) {
          console.log('rows: ', rows);
          console.log('error: ', error);
          res.json({rows});
      }       
    }else{
        res.status(200).json({ rows });

    }
         
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while updating last accessed content' });
    }
  });
 router.get('/Get_Teachers_By_Course/:course_Id_?', async (req, res, next) => {
    try {
        const rows = await course.Get_Teachers_By_Course(req.params.course_Id_);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get Teachers', error: e.message });
    }
});

router.get('/Get_Teachers_By_Course_And_Batch', async (req, res, next) => {
    try {
        const { Course_Id, Batch_Id } = req.query;
        const db = require('../config/dbconnection');
        const query = `
            SELECT u.User_ID as Teacher_ID, CONCAT(u.First_Name, ' ', u.Last_Name) as Teacher_Name, tts.Slot_Id
            FROM course_teacher ct
            JOIN users u ON ct.Teacher_ID = u.User_ID
            LEFT JOIN teacher_time_slot tts ON tts.CourseTeacher_ID = ct.CourseTeacher_ID AND tts.Delete_Status = 0 AND (tts.batch_id = ? OR tts.batch_id IS NULL)
            WHERE ct.Course_ID = ? AND ct.Delete_Status = 0
            GROUP BY u.User_ID, tts.Slot_Id
        `;
        const [rows] = await db.promise().query(query, [Batch_Id, Course_Id]);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get Teachers by batch', error: e.message });
    }
});
 router.post('/Delete_Course_Content/:content_Id?', async (req, res, next) => {
    try {
        const rows = await course.Delete_Course_Content(req.params.content_Id);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get Teachers', error: e.message });
    }
});
 router.get('/Get_Sections_By_Course/:course_Id_?', async (req, res, next) => {
    try {
        const rows = await course.Get_Sections_By_Course(req.params.course_Id_);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get Teachers', error: e.message });
    }
});
 router.get('/get_course_Batches/:course_Id_?', async (req, res, next) => {
    try {
        const rows = await course.get_course_Batches(req.params.course_Id_);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get Teachers', error: e.message });
    }
});
router.post('/Save_Student_Exam', async (req, res) => {
    try {
   
  
      // Call the model function to insert student exam and answers
      const result = await course.Save_Student_Exam(req);
  
      res.status(200).json({ message: 'Student exam and answers inserted successfully', result });
    } catch (err) {
      console.error(err);
      if (err.code === 'ER_SIGNAL_EXCEPTION') {
        res.status(500).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
      
    }
  });
  router.post('/Update_Time_Slot', async (req, res) => {
    try {
      const { Student_ID, Course_ID, Slot_Id } = req.body;
  
      // Call the model function to update last accessed content
      await course.Update_Time_Slot(Student_ID, Course_ID, Slot_Id);
  
      res.status(200).json({ message: 'Slot Id updated successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while updating slot id' });
    }
  });
  router.get('/Get_course_content_By_Module/:course_Id_?/:Module_ID_?', async(req, res, next) => {
    try {
        const rows = await course.Get_course_content_By_Module(req.params.course_Id_,req.params.Module_ID_);
        res.json(rows[0][0]);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get course content', error: e.message });
    }
});
//   router.get('/Get_course_content_By_Day/:course_Id_?/:Module_ID_?/:Section_ID?/:Day_Id', async(req, res, next) => {
//     try {
//         const rows = await course.Get_course_content_By_Day(req.params.course_Id_,req.params.Module_ID_,req.params.Section_ID,req.params.Day_Id,req.userId,req.query.isLibrary);
//         res.json(rows[0][0]);
//     } catch (e) {
//         res.status(500).json({ success: false, message: 'Failed to get course content', error: e.message });
//     }
// });
router.get('/Get_course_content_By_Day', async (req, res, next) => {
    try {
        const {
            Course_Id,
            Module_ID,
            Section_ID,
            Day_Id,Batch_ID,Is_Exam_Test
        } = req.query; // Accessing query parameters
        
        console.log(' req.query.is_Student: ',  req.query.is_Student);
        console.log(' req.query.is_Student: ',  req.query.Is_Exam_Test);
        const rows = await course.Get_course_content_By_Day(
            Course_Id,
            Module_ID,
            Section_ID,
            Day_Id,
            req.query.is_Student=='false'?0:req.userId,
            req.query.isLibrary,
            Batch_ID?Batch_ID:0,
            Is_Exam_Test?Is_Exam_Test:0,
        );
        
        res.json(rows[0][0]);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get course content', error: e.message });
    }
});
router.get('/Get_Course_Module/', async(req, res, next) => {
    try {
        const rows = await course.Get_Course_Module();
        res.json(rows[0]);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get course modules', error: e.message });
    }
});

router.get('/Get_Course_Info/:course_Id_?', async(req, res, next) => {
    try {
        const rows = await course.Get_Course_Info(req.params.course_Id_);
        res.json(rows[0]);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get course info', error: e.message });
    }
});
router.get('/get_Examof_Course/:course_Id_?', async(req, res, next) => {
    try {
        const rows = await course.get_Examof_Course(req.params.course_Id_);
        res.json(rows[0]);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get course info', error: e.message });
    }
});
router.get('/Get_Student_List_By_Batch/:batchId?', async(req, res, next) => {
    try {
        const rows = await course.Get_Student_List_By_Batch(req.params.batchId);
        res.json(rows[0]);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get course info', error: e.message });
    }
});
router.get('/Get_Exam_Modules_By_CourseId/:course_Id_?', async(req, res, next) => {
    try {
        const rows = await course.Get_Exam_Modules_By_CourseId(req.params.course_Id_);
        res.json(rows[0]);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get course info', error: e.message });
    }
});
router.get('/Get_Module_Of_Course/:course_Id_?', async(req, res, next) => {
    try {
        const rows = await course.Get_Module_Of_Course(req.params.course_Id_,req.userId);
        res.json(rows[0]);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get course info', error: e.message });
    }
});
router.get('/Get_Exam_Days_By_Module/:course_Id_?/:Module_ID?', async(req, res, next) => {
    try {
        const rows = await course.Get_Exam_Days_By_Module(req.userId,req.params.course_Id_,req.params.Module_ID);
        res.json(rows[0]);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get course info', error: e.message });
    }
});
router.get('/Get_Student_ClassRecords/', async(req, res, next) => {
    try {
        console.log('req.query: ', req.query);
        const rows = await course.Get_Student_ClassRecords(req.query.course_Id,req.query.batch_Id?req.query.batch_Id:0,req.userId,req.isStudent);
        res.json(rows[0]);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get course info', error: e.message });
    }
});
async function sendNotificationsToMultipleDevices(studentsList, title, body, data) {
    const results = {
      successful: [],
      failed: []
    };
  
    for (const student of studentsList) {
      try {
        const userTopic = `STD-${student.Student_ID}`;

        await sendNotifToTopic(userTopic, title,body, data);

        // await sendNotif(token, title, body, data);
        results.successful.push(userTopic);
        console.log(`Notification sent successfully to userTopic: ${userTopic}`);
      } catch (error) {
        results.failed.push({ userTopic, error: error.message });
        console.error(`Failed to send notification to userTopic: ${userTopic}. Error: ${error.message}`);
      }
    }
  
    return results;
  }
 module.exports = router; 