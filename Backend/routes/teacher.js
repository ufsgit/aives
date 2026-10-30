var express = require('express');
var router = express.Router();
const {subscribeToTopic,sendNotifToTopic,sendAppleNotification} = require('../helpers/firebase');
const { executeTransaction } = require('../helpers/sp-caller');
var user=require('../models/user');

var teacher = require('../models/teacher');
router.get('/Get_Teacher_courses/:teacher_Id_?', async(req, res, next) => {
    try {
        console.log('req.params.teacher_Id333_: ', req.params.teacher_Id_);
        const rows = await teacher.Get_Teacher_courses(req.params.teacher_Id_);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});
router.get('/Get_Teacher_courses_With_Batch/:teacher_Id_?', async(req, res, next) => {
    try {
        console.log('req.params.teacher_Id_: ', req.params.teacher_Id_);
        const rows = await teacher.Get_Teacher_courses_With_Batch(req.params.teacher_Id_);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});
router.get('/Get_Teacher_Students/:teacher_Id_/:course_id_?', async(req, res, next) => {
    try {
        const teacherId = req.params.teacher_Id_;
        const courseId = req.params.course_id_ || 0;
        const rows = await teacher.Get_Teacher_Students(teacherId, courseId);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});
router.get('/Get_Staff_Team_Assignment/:team_lead_id', async(req, res, next) => {
    try {
        const teamLeadId = Number(req.params.team_lead_id);
        if (!Number.isInteger(teamLeadId) || teamLeadId <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid team lead id' });
        }

        const rows = await teacher.Get_Staff_Team_Assignment(teamLeadId);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get team assignment', error: e.message });
    }
});
router.post('/Save_Staff_Team_Assignment/', async(req, res, next) => {
    try {
        const teamLeadId = Number(req.body?.teamLeadId);
        const staffIds = req.body?.staffIds;

        if (!Number.isInteger(teamLeadId) || teamLeadId <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid team lead id' });
        }

        const rows = await teacher.Save_Staff_Team_Assignment(teamLeadId, staffIds);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to save team assignment', error: e.message });
    }
});
router.get('/Get_teacherBatch_of_oneOnOne/:teacher_Id_?', async(req, res, next) => {
    try {
        console.log('req.params.teacher_Id_: ', req.params.teacher_Id_);
        const rows = await teacher.Get_teacherBatch_of_oneOnOne(req.params.teacher_Id_);
        const filteredRows = rows.filter(row => row.Batch_IDs !== null);
        res.json(filteredRows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});

router.get('/Get_OnGoing_liveClass?', async(req, res, next) => {
    try {
        const rows = await teacher.Get_OnGoing_liveClass(req.userId);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get live classes', error: e.message });
    }
});
router.get('/Get_Upcomming_liveClass?', async(req, res, next) => {
    try {
        const rows = await teacher.Get_Upcomming_liveClass(req.userId);

        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get live classes', error: e.message });
    }
});
router.get('/Get_Completed_liveClass?', async(req, res, next) => {
    try {
        const rows = await teacher.Get_Completed_liveClass(req.userId);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get live classes', error: e.message });
    }
});
router.get('/Get_liveClass?', async(req, res, next) => {
    try {
        const rows = await teacher.Get_liveClass(req.userId);
        res.json(rows);
    } catch (e) {
        console.log('e: ', e);
        res.status(500).json({ success: false, message: 'Failed to get live classes', error: e.message });
    }
});
router.get('/Get_Student_TimeSlots_By_TeacherID?', async(req, res, next) => {
    try {
        const rows = await teacher.Get_Student_TimeSlots_By_TeacherID(req.userId);
        res.json(rows);
    } catch (e) {
        console.log('e: ', e);
        res.status(500).json({ success: false, message: 'Failed to get live classes', error: e.message });
    }
});
router.get('/Get_Teacher_Timing/?:Teacher_Id', async(req, res, next) => {
    try {
        const rows = await teacher.Get_Teacher_Timing(req.params.Teacher_Id);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get live classes', error: e.message });
    }
});
router.post('/Update_Record_ClassLink/', async(req, res, next) => {
    try {
        const rows = await teacher.Update_Record_ClassLink(req.body);
        res.json(rows);



    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to save message', error: e.message });
    }
});
router.post('/Save_LiveClass/', async(req, res, next) => {
    try {

        console.log('req.body: LiveClass', req.body);
        const rows = await teacher.Save_LiveClass(req.body);
        console.log('rows: ', rows);
        if (rows) {

            const studentsList = await teacher.Get_Batch_StudentList(req.body.Batch_Id);

            const userTopic = `Grp-${req.body.Course_ID}-${req.body.Batch_Id}`;
            console.log('userTopic: ', userTopic);
            list = await executeTransaction('Get_Live_Classes_By_CourseId', [req.body.Course_ID, 0, req.body.Batch_Id]);
            console.log('\list:Get_Live_Classes_By_CourseId ', list);

            req.io.to(userTopic).emit('Get_Live_Classes_By_CourseId', list);
            if (rows ) {
            // if (rows.length && rows[0]['Is_Finished'] == 0) {

                const teacherData = await user.Get_user(req.body.Teacher_ID);
                console.log('teacherData: ', teacherData);


                //  var message = { 
                //     registration_ids: deviceIds,
                //     notification: {
                //         title: 'Incoming Call',
                //         body: "Your Live Class Has Been  Started",
                //         sound: 'ringtone' // Custom ringtone for the call
                //     },
                //     data: {
                //         type: 'new_live',
                //         callId: '12345',
                //         click_action: "FLUTTER_NOTIFICATION_CLICK" // Action to handle click in the client app
                //     }
                // };

                // fcm.send(message, function(err, response) {
                //     if (err) {
                //         console.log("Something has gone wrong!" + err);
                //         console.log("Response:!" + response);

                //     } else {
                //         console.log("Successfully sent with response: ", response);
                //         console.log("Response:!" + response['results'][0]['error']);
                //     }
                // });

                try {
                    let data = {
                        type: 'new_live',
                        status:`${req.body.Is_Finished}`,
                        Live_Link: `${req.body.Live_Link}`,
                        id: String( rows[0].LiveClass_ID),
                        Teacher_Id:`${teacherData[0].User_ID}`,
                        Profile_Photo_Img:`${teacherData[0].Profile_Photo_Path}`,
                        Teacher_Name:`${teacherData[0].First_Name} ${teacherData[0].Last_Name}`,
                        click_action: "FLUTTER_NOTIFICATION_CLICK" // Action to handle click in the client app
                    }
                    const extraData = {
                        extra: {
                          Live_Link:`${req.body.Live_Link}`,
                          type: "new_live",
                          teacher_id: `${teacherData[0].User_ID}`,
                          student_id: String(''),
                          id: String( rows[0].LiveClass_ID),
                          call_type:`${req.body.call_type}`,
                          profile_url:`${teacherData[0].Profile_Photo_Path}`,
                          teacher_name:`${teacherData[0].First_Name} ${teacherData[0].Last_Name}`,
                          student_name:String(''),
                          Caller_Name:`${teacherData[0].First_Name} ${teacherData[0].Last_Name}`,
                          handle: "+1234567890",
                          Is_Student_Called:0,
                          Is_Finished:`${req.body.Is_Finished}`,
                
                        }
                      };
            
                    console.log('data: ', data);
                    const title = "Live Class";
                    const body = req.body.Is_Finished?"Your Live Class Has Been  Ended":"Your Live Class Has Been  Started";
                    const notificationResults = await sendNotificationsToMultipleDevices(studentsList, title, body, data,extraData);
                    console.log('Notification results:', notificationResults);


                    console.log('rows: ', rows);
                    console.log('...rows,studentsList}: ',[...rows,studentsList]);
                    res.json([...rows,studentsList]);
                } catch (error) {
                    console.log('rows: ', rows);
                    console.log('error: ', error);
                    res.json(rows);
                }

            } else {
                console.log('rows: without noti', rows);
                res.json(rows);

            }

        }
    } catch (e) {
        console.log('e: ', e);
        console.log('req.body: ', req.body);
        res.status(500).json({ success: false, message: 'Failed to save Live class', error: e.message });
    }
});

async function sendNotificationsToMultipleDevices(studentsList, title, body, data,extraData) {
    console.log('studentsList: ', studentsList);
    const results = {
        successful: [],
        failed: []
    };

    const sendNotificationToStudent = async (student) => {
        const userTopic = `STD-${student.Student_ID}`;
        
        try {
    
            if (student.devicePushTokenVoip && extraData.extra.Is_Finished==0) {
                extraData.extra.student_id = student.Student_ID;
                extraData.extra.student_name = `${student.Name}`;
                await sendAppleNotification(student.devicePushTokenVoip, "Incoming Call", "Incoming call from caller", extraData);
            }
            
            await sendNotifToTopic(userTopic, title, body, data); 
            results.successful.push(userTopic);

        } catch (error) {
            results.failed.push({
                userTopic,
                error: error.message || 'Unknown error'
            });
            console.error(`✗ Failed: ${userTopic} - ${error.message}`);
        }
    };

    for (const student of studentsList) {
        await sendNotificationToStudent(student);
    }

    console.log('Notification Summary:', {
        total: studentsList.length,
        successful: results.successful.length,
        failed: results.failed.length
    });

    return results;
}



module.exports = router;
