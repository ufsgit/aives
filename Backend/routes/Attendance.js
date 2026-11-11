const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const { sendWhatsAppMessage } = require('../helpers/whatsapp-helper');
const studentModel = require('../models/student');
const db = require('../config/dbconnection');
const emailHelper = require('../helpers/email-helper');
const emailLog = require('../models/email_log');

// Helper to check if a user is an admin
async function checkIsAdmin(userId, userTypeId, userEmail) {
    if (parseInt(userId) === 1) return true;
    if (userEmail && (userEmail.toLowerCase() === 'admin_user@g.com' || userEmail.toLowerCase() === 'cs.mgr@testprepinenglish.com')) return true;
    if (userId) {
        try {
            const [rows] = await db.promise().query('SELECT User_ID, User_Type_Id, Email FROM users WHERE User_ID = ?', [userId]);
            if (rows && rows.length > 0) {
                const u = rows[0];
                if (u.User_ID === 1 || (u.Email && (u.Email.toLowerCase() === 'admin_user@g.com' || u.Email.toLowerCase() === 'cs.mgr@testprepinenglish.com'))) {
                    return true;
                }
            }
        } catch (err) {
            console.error('[checkIsAdmin] Error checking admin status:', err.message);
        }
    }
    return false;
}

// Helper to get all courses assigned to a staff member
async function getStaffAssignedCourses(staffId) {
    if (!staffId) return [];
    try {
        const [rows] = await db.promise().query(
            `SELECT DISTINCT c.Course_ID, c.Course_Name
             FROM course_teacher ct
             JOIN course c ON ct.Course_ID = c.Course_ID
             WHERE ct.Teacher_ID = ? 
               AND IFNULL(ct.Delete_Status, 0) = 0 
               AND IFNULL(c.Delete_Status, 0) = 0
             ORDER BY c.Course_Name ASC`,
            [staffId]
        );
        return rows || [];
    } catch (err) {
        console.error('[getStaffAssignedCourses] Error:', err.message);
        return [];
    }
}

// Helper to get assigned course IDs for a staff member
async function getStaffAssignedCourseIds(staffId) {
    const courses = await getStaffAssignedCourses(staffId);
    return courses.map(c => c.Course_ID);
}

// Helper to get batches assigned to a staff member for a specific course
async function getStaffAssignedBatches(staffId, courseId) {
    if (!staffId || !courseId) return [];
    try {
        // 1. Check if specific batches are assigned in teacher_time_slot
        const [batchRows] = await db.promise().query(
            `SELECT DISTINCT cb.Batch_ID, cb.Batch_Name, cb.Course_ID, cb.Start_Date, cb.End_Date
             FROM teacher_time_slot tts
             JOIN course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
             JOIN course_batch cb ON tts.batch_id = cb.Batch_ID
             WHERE ct.Teacher_ID = ? 
               AND ct.Course_ID = ?
               AND IFNULL(tts.Delete_Status, 0) = 0
               AND IFNULL(ct.Delete_Status, 0) = 0
               AND IFNULL(cb.Delete_Status, 0) = 0
             ORDER BY cb.Batch_Name ASC`,
            [staffId, courseId]
        );
        if (batchRows && batchRows.length > 0) {
            return batchRows;
        }

        // 2. Fallback: if assigned to the course in course_teacher, allow all active batches of that course
        const [courseCheck] = await db.promise().query(
            `SELECT 1 FROM course_teacher WHERE Teacher_ID = ? AND Course_ID = ? AND IFNULL(Delete_Status, 0) = 0 LIMIT 1`,
            [staffId, courseId]
        );
        if (courseCheck && courseCheck.length > 0) {
            const [allBatches] = await db.promise().query(
                `SELECT Batch_ID, Batch_Name, Course_ID, Start_Date, End_Date
                 FROM course_batch
                 WHERE Course_ID = ? AND IFNULL(Delete_Status, 0) = 0
                 ORDER BY Batch_Name ASC`,
                [courseId]
            );
            return allBatches || [];
        }
        return [];
    } catch (err) {
        console.error('[getStaffAssignedBatches] Error:', err.message);
        return [];
    }
}

router.get('/Get_Attendance_Courses', async (req, res) => {
    try {
        const queryStaffId = parseInt(req.query.staffId) || 0;
        const currentUserId = req.userId || queryStaffId;
        const isAdmin = await checkIsAdmin(currentUserId, req.userTypeId, req.userEmail);

        if (isAdmin && !queryStaffId) {
            const [allCourses] = await db.promise().query(
                `SELECT Course_ID, Course_Name 
                 FROM course 
                 WHERE Delete_Status = 0 
                 ORDER BY Course_Name ASC`
            );
            return res.json({ success: true, data: allCourses || [] });
        }

        const targetStaffId = queryStaffId > 0 ? queryStaffId : currentUserId;
        const assignedCourses = await getStaffAssignedCourses(targetStaffId);
        return res.json({ success: true, data: assignedCourses || [] });
    } catch (error) {
        console.error('Get_Attendance_Courses Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch attendance courses', error: error.message });
    }
});

router.get('/Get_Attendance_Batches', async (req, res) => {
    try {
        const courseId = parseInt(req.query.courseId) || 0;
        const queryStaffId = parseInt(req.query.staffId) || 0;
        const currentUserId = req.userId || queryStaffId;

        if (!courseId) {
            return res.json({ success: true, data: [] });
        }

        const isAdmin = await checkIsAdmin(currentUserId, req.userTypeId, req.userEmail);

        if (isAdmin && !queryStaffId) {
            const [batches] = await db.promise().query(
                `SELECT Batch_ID, Batch_Name, Course_ID, Start_Date, End_Date 
                 FROM course_batch 
                 WHERE Course_ID = ? AND Delete_Status = 0 
                 ORDER BY Batch_Name ASC`,
                [courseId]
            );
            return res.json({ success: true, data: batches || [] });
        }

        const targetStaffId = queryStaffId > 0 ? queryStaffId : currentUserId;
        const batches = await getStaffAssignedBatches(targetStaffId, courseId);
        return res.json({ success: true, data: batches || [] });
    } catch (error) {
        console.error('Get_Attendance_Batches Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch attendance batches', error: error.message });
    }
});

router.post('/Save_Attendance', async (req, res) => {
    try {
        const { attendanceData, markedBy } = req.body;

        if (!attendanceData || !Array.isArray(attendanceData) || attendanceData.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid attendance data.' });
        }

        const effectiveUserId = req.userId || markedBy || 0;
        const isAdmin = await checkIsAdmin(effectiveUserId, req.userTypeId, req.userEmail);

        if (!isAdmin) {
            const assignedCourseIds = await getStaffAssignedCourseIds(effectiveUserId);
            const targetCourseId = parseInt(attendanceData[0]?.Course_ID) || 0;
            if (!targetCourseId || !assignedCourseIds.includes(targetCourseId)) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access denied: You are only allowed to mark attendance for courses assigned to you.' 
                });
            }
        }

        // 1. Save to Database
        await Attendance.Save_Attendance(attendanceData, markedBy || req.userId);

        // 2. Filter Absent Students and Send WhatsApp
        const absentStudents = attendanceData.filter(a => a.Status === 0);
        
        for (const record of absentStudents) {
            try {
                // Fetch student details to get name and parent contact
                const studentDetails = await studentModel.Get_student(record.Student_ID, 1);
                if (studentDetails && studentDetails[0] && studentDetails[0][0]) {
                    const student = studentDetails[0][0];
                    const parentPhone = student.Guardian_Phone || student.Phone_Number;
                    const studentName = `${student.First_Name} ${student.Last_Name}`;
                    const dateStr = record.Attendance_Date;
                    
                    // Trigger WhatsApp Notification
                    // Note: We use a try-catch inside the loop so one failure doesn't stop others
                    await sendWhatsAppMessage(
                        parentPhone, 
                        studentName, 
                        dateStr, 
                        record.Course_Name || 'Course', 
                        record.Batch_Name || 'Batch'
                    );
                }
            } catch (waError) {
                console.error(`Failed to send WhatsApp for student ${record.Student_ID}:`, waError.message);
            }
        }

        // 3. Send Attendance Email based on Student Attendance Count
        // 3. Send Attendance Email based on Student Attendance Count (Sent to ALL students regardless of Present, Absent, or Late)
        try {
            // Pre-fetch eligible templates: 1st, 2nd, 5th, 10th and any interval
            const [firstDayTemplates] = await db.promise().query(
                `SELECT * FROM email_templates 
                 WHERE Delete_Status = 0 
                   AND Is_Active = 1
                   AND (Attendance_Count = 1 OR LOWER(TRIM(Template_Name)) IN ('first day attendance', '1 day attendance', '1 days attendance', 'day 1 attendance', 'count 1', 'first', 'first day'))
                 ORDER BY (Attendance_Count = 1) DESC, Template_ID DESC LIMIT 1`
            );
            const firstDayTemplate = firstDayTemplates[0] || null;

            const [secondDayTemplates] = await db.promise().query(
                `SELECT * FROM email_templates 
                 WHERE Delete_Status = 0 
                   AND Is_Active = 1
                   AND (Attendance_Count = 2 OR LOWER(TRIM(Template_Name)) IN ('second day attendance', '2 day attendance', '2 days attendance', 'day 2 attendance', 'count 2'))
                 ORDER BY (Attendance_Count = 2) DESC, Template_ID DESC LIMIT 1`
            );
            const secondDayTemplate = secondDayTemplates[0] || null;

            const [fiveDayTemplates] = await db.promise().query(
                `SELECT * FROM email_templates 
                 WHERE Delete_Status = 0 
                   AND Is_Active = 1
                   AND (Attendance_Count = 5 OR LOWER(TRIM(Template_Name)) IN ('five day attendance', '5 days attendance', '5 day attendance', 'day 5 attendance', 'count 5', '5', '5th mail', '5th email'))
                 ORDER BY (Attendance_Count = 5) DESC, Template_ID DESC LIMIT 1`
            );
            const fiveDayTemplate = fiveDayTemplates[0] || null;

            const [tenDayTemplates] = await db.promise().query(
                `SELECT * FROM email_templates 
                 WHERE Delete_Status = 0 
                   AND Is_Active = 1
                   AND (Attendance_Count = 10 OR LOWER(TRIM(Template_Name)) IN ('ten day attendance', '10 days attendance', '10 day attendance', '10 days', 'day 10 attendance', 'count 10', '10', '10th mail', '10th email'))
                 ORDER BY (Attendance_Count = 10) DESC, Template_ID DESC LIMIT 1`
            );
            const tenDayTemplate = tenDayTemplates[0] || null;

            // Process ALL students in attendanceData regardless of their status (Present, Absent, or Late)
            const studentsToProcess = [];
            const seenStudentIds = new Set();
            for (const record of attendanceData) {
                if (record && record.Student_ID && !seenStudentIds.has(record.Student_ID)) {
                    seenStudentIds.add(record.Student_ID);
                    studentsToProcess.push(record);
                }
            }

            for (const record of studentsToProcess) {
                const studentId = record.Student_ID;
                const courseId = record.Course_ID || attendanceData[0]?.Course_ID;
                const batchId = record.Batch_ID || attendanceData[0]?.Batch_ID;
                const attendanceDate = record.Attendance_Date || attendanceData[0]?.Attendance_Date;
                
                let cleanDate;
                if (typeof attendanceDate === 'string') {
                    cleanDate = attendanceDate.split('T')[0].split(' ')[0];
                } else if (attendanceDate instanceof Date) {
                    const year = attendanceDate.getFullYear();
                    const month = String(attendanceDate.getMonth() + 1).padStart(2, '0');
                    const day = String(attendanceDate.getDate()).padStart(2, '0');
                    cleanDate = `${year}-${month}-${day}`;
                } else {
                    cleanDate = new Date().toISOString().split('T')[0];
                }

                if (!studentId || !courseId || !batchId) {
                    continue;
                }

                // Calculate attendance session count for this student regardless of Present, Absent, or Late
                const [countRes] = await db.promise().query(
                    `SELECT COUNT(DISTINCT DATE(am.Attendance_Date)) as studentAttendanceCount 
                     FROM attendance_details ad
                     JOIN attendance_master am ON ad.Attendance_ID = am.Attendance_ID
                     WHERE ad.Student_ID = ?
                       AND am.Course_ID = ?
                       AND am.Batch_ID = ?
                       AND DATE(am.Attendance_Date) <= DATE(?)`,
                    [studentId, courseId, batchId, cleanDate]
                );
                let studentAttendanceCount = countRes[0]?.studentAttendanceCount || 0;

                // Fallback to batch session count if needed
                if (!studentAttendanceCount || studentAttendanceCount === 0) {
                    const [batchCountRes] = await db.promise().query(
                        `SELECT COUNT(DISTINCT DATE(Attendance_Date)) as batchAttendanceCount
                         FROM attendance_master
                         WHERE Course_ID = ? AND Batch_ID = ? AND DATE(Attendance_Date) <= DATE(?)`,
                        [courseId, batchId, cleanDate]
                    );
                    studentAttendanceCount = batchCountRes[0]?.batchAttendanceCount || 1;
                }

                console.log(`[Save_Attendance] Student ${studentId} (status: ${record.Status}) session count for batch ${batchId}, course ${courseId} as of ${cleanDate}: ${studentAttendanceCount}`);

                // Determine template based on student attendance sequence:
                // 1. Check if any active template has Attendance_Count matching this sequence count (> 0)
                let template = null;
                const [matchingTemplates] = await db.promise().query(
                    `SELECT * FROM email_templates 
                     WHERE Delete_Status = 0 
                       AND Is_Active = 1
                       AND Attendance_Count = ? 
                       AND Attendance_Count > 0
                     ORDER BY Template_ID DESC LIMIT 1`,
                    [studentAttendanceCount]
                );

                if (matchingTemplates && matchingTemplates.length > 0) {
                    template = matchingTemplates[0];
                } else {
                    // Fallback to pre-fetched standard templates
                    if (studentAttendanceCount === 1) {
                        template = firstDayTemplate;
                    } else if (studentAttendanceCount === 2) {
                        template = secondDayTemplate;
                    } else if (studentAttendanceCount === 5) {
                        template = fiveDayTemplate;
                    } else if (studentAttendanceCount === 10) {
                        template = tenDayTemplate;
                    }

                    // Dynamic name-based match for subsequent intervals (e.g. 15, 20, etc.)
                    if (!template) {
                        const [dynamicTemplates] = await db.promise().query(
                            `SELECT * FROM email_templates 
                             WHERE Delete_Status = 0 
                               AND Is_Active = 1
                               AND (
                                 Attendance_Count = ?
                                 OR LOWER(TRIM(Template_Name)) = ?
                                 OR LOWER(TRIM(Template_Name)) = CONCAT(?, ' day attendance')
                                 OR LOWER(TRIM(Template_Name)) = CONCAT(?, ' days attendance')
                                 OR LOWER(TRIM(Template_Name)) = CONCAT(?, ' day')
                                 OR LOWER(TRIM(Template_Name)) = CONCAT(?, ' days')
                                 OR LOWER(TRIM(Template_Name)) = CONCAT(?, 'th email')
                                 OR LOWER(TRIM(Template_Name)) = CONCAT(?, 'th mail')
                                 OR LOWER(TRIM(Template_Name)) = CONCAT('day ', ?)
                                 OR LOWER(TRIM(Template_Name)) = CONCAT('count ', ?)
                               )
                             ORDER BY (Attendance_Count = ?) DESC, Template_ID DESC LIMIT 1`,
                            [
                              studentAttendanceCount, 
                              String(studentAttendanceCount), 
                              studentAttendanceCount, 
                              studentAttendanceCount, 
                              studentAttendanceCount, 
                              studentAttendanceCount, 
                              studentAttendanceCount, 
                              studentAttendanceCount, 
                              studentAttendanceCount, 
                              studentAttendanceCount, 
                              studentAttendanceCount
                            ]
                        );
                        if (dynamicTemplates && dynamicTemplates.length > 0) {
                            template = dynamicTemplates[0];
                        }
                    }
                }

                if (!template) {
                    console.log(`[Save_Attendance] No template found for student ${studentId} (attendance count: ${studentAttendanceCount}). Skipping email.`);
                    continue;
                }

                let toEmail = null;
                let studentName = '';
                let subject = template.Subject || '';
                let htmlBody = template.Body || '';

                try {
                    const studentDetails = await studentModel.Get_student(studentId, 1);
                    if (studentDetails && studentDetails[0] && studentDetails[0][0]) {
                        const student = studentDetails[0][0];
                        toEmail = student.Email ? student.Email.trim() : null;
                        studentName = `${student.First_Name || ''} ${student.Last_Name || ''}`.trim();
                    }

                    const replacePlaceholders = (text) => {
                        return (text || '')
                            .replace(/\{\{attendance_count\}\}/gi, studentAttendanceCount)
                            .replace(/\[Attendance_Count\]/gi, studentAttendanceCount)
                            .replace(/\[attendance_count\]/gi, studentAttendanceCount)
                            .replace(/\[Student Name\]/gi, studentName)
                            .replace(/\[Student_Name\]/gi, studentName)
                            .replace(/\[anusree\]/gi, studentName)
                            .replace(/\[Course\]/gi, record.Course_Name || attendanceData[0]?.Course_Name || '')
                            .replace(/\[Course_Name\]/gi, record.Course_Name || attendanceData[0]?.Course_Name || '')
                            .replace(/\[Batch\]/gi, record.Batch_Name || attendanceData[0]?.Batch_Name || '')
                            .replace(/\[Batch_Name\]/gi, record.Batch_Name || attendanceData[0]?.Batch_Name || '');
                    };

                    subject = replacePlaceholders(subject);
                    htmlBody = replacePlaceholders(htmlBody);

                    if (!toEmail) {
                        console.warn(`[Save_Attendance] Student ${studentId} does not have an email address. Skipping.`);
                        await emailLog.Save_Email_Log(
                            studentId,
                            template.Template_ID || null,
                            null,
                            subject,
                            null,
                            htmlBody,
                            'Failed',
                            'Student does not have an email address'
                        );
                        continue;
                    }

                    // Final guard: skip if template Is_Active is not 1 (handles edge cases where column may differ)
                    if (parseInt(template.Is_Active) !== 1) {
                        console.log(`[Save_Attendance] Template '${template.Template_Name}' (ID: ${template.Template_ID}) is inactive. Skipping email for student ${studentId}.`);
                        continue;
                    }

                    const response = await emailHelper.sendEmail(
                        toEmail,
                        subject,
                        htmlBody,
                        req.userEmail || null,
                        "TestPerp Aives"
                    );

                    let messageId = null;
                    if (response && response.messageId) {
                        messageId = response.messageId;
                    }

                    await emailLog.Save_Email_Log(
                        studentId,
                        template.Template_ID || null,
                        toEmail,
                        subject,
                        messageId,
                        htmlBody,
                        'Success',
                        null
                    );
                    console.log(`[Save_Attendance] Sent '${template.Template_Name}' email to student ${studentId} (${studentName}) - Attendance Status: ${record.Status} (session count: ${studentAttendanceCount}).`);
                } catch (emailErr) {
                    console.error(`Failed to send attendance email for student ${studentId}:`, emailErr.message);
                    await emailLog.Save_Email_Log(
                        studentId,
                        template.Template_ID || null,
                        toEmail,
                        subject,
                        null,
                        htmlBody,
                        'Failed',
                        emailErr.message
                    );
                }
            }
        } catch (emailProcessErr) {
            console.error('[Save_Attendance] Error processing attendance emails:', emailProcessErr.message);
        }

        res.json({ success: true, message: 'Attendance saved and notifications sent.' });
    } catch (error) {
        console.error('Save_Attendance Error:', error);
        res.status(500).json({ success: false, message: 'Failed to save attendance', error: error.message });
    }
});

router.get('/Get_Attendance_History', async (req, res) => {
    try {
        const { courseId, batchId, fromDate, toDate, page, pageSize, staffId: queryStaffId } = req.query;
        const currentUserId = req.userId || parseInt(queryStaffId) || 0;
        const isAdmin = await checkIsAdmin(currentUserId, req.userTypeId, req.userEmail);

        let allowedCourseIds = null;
        if (!isAdmin) {
            allowedCourseIds = await getStaffAssignedCourseIds(currentUserId);
        }

        const results = await Attendance.Get_Attendance_History(
            parseInt(courseId) || 0,
            parseInt(batchId) || 0,
            fromDate || '',
            toDate || '',
            currentUserId,
            parseInt(page) || 1,
            parseInt(pageSize) || 10,
            allowedCourseIds
        );
        res.json({ 
            success: true, 
            data: results[1] || [], 
            totalRecords: results[0]?.[0]?.total_count || 0 
        });
    } catch (error) {
        console.error('Get_Attendance_History Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch attendance history', error: error.message });
    }
});


router.get('/Get_Attendance_Summary_Report', async (req, res) => {
    try {
        const { studentId, courseId, batchId, fromDate, toDate, teacherId, status, staffId: queryStaffId } = req.query;
        const currentUserId = req.userId || parseInt(queryStaffId) || parseInt(teacherId) || 0;
        const isAdmin = await checkIsAdmin(currentUserId, req.userTypeId, req.userEmail);
        let effCourseId = parseInt(courseId) || 0;
        let effTeacherId = parseInt(teacherId) || 0;

        if (!isAdmin) {
            effTeacherId = currentUserId;
            const allowedCourseIds = await getStaffAssignedCourseIds(currentUserId);
            if (effCourseId > 0 && !allowedCourseIds.includes(effCourseId)) {
                return res.status(403).json({ success: false, message: 'Access denied: You are not authorized for this course.' });
            }
        }

        const results = await Attendance.Get_Attendance_Summary_Report(
            parseInt(studentId) || 0,
            effCourseId,
            parseInt(batchId) || 0,
            fromDate || '',
            toDate || '',
            effTeacherId,
            status !== undefined ? parseInt(status) : -1
        );
        res.json({ 
            success: true, 
            data: results[0] || [], 
            summary: results[1] ? results[1][0] : null 
        });
    } catch (error) {
        console.error('Get_Attendance_Summary_Report Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch attendance summary report', error: error.message });
    }
});

router.post('/Delete_Attendance', async (req, res) => {
    try {
        const { courseId, batchId, date, staffId: bodyStaffId } = req.body;
        const currentUserId = req.userId || parseInt(bodyStaffId) || 0;
        const isAdmin = await checkIsAdmin(currentUserId, req.userTypeId, req.userEmail);
        const reqCourseId = parseInt(courseId) || 0;

        if (!isAdmin) {
            const allowedCourseIds = await getStaffAssignedCourseIds(currentUserId);
            if (!allowedCourseIds.includes(reqCourseId)) {
                return res.status(403).json({ success: false, message: 'Access denied: You are not authorized to delete attendance for this course.' });
            }
        }

        await Attendance.Delete_Attendance(reqCourseId, batchId, date);
        res.json({ success: true, message: 'Attendance record deleted successfully.' });
    } catch (error) {
        console.error('Delete_Attendance Error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete attendance record', error: error.message });
    }
});

router.get('/Get_Attendance_Details_By_Session', async (req, res) => {
    try {
        const { courseId, batchId, date, staffId: queryStaffId } = req.query;
        const currentUserId = req.userId || parseInt(queryStaffId) || 0;
        const isAdmin = await checkIsAdmin(currentUserId, req.userTypeId, req.userEmail);
        const reqCourseId = parseInt(courseId) || 0;

        if (!isAdmin) {
            const allowedCourseIds = await getStaffAssignedCourseIds(currentUserId);
            if (!allowedCourseIds.includes(reqCourseId)) {
                return res.status(403).json({ success: false, message: 'Access denied: You are not authorized to view attendance for this course.' });
            }
        }

        const results = await Attendance.Get_Attendance_Details_By_Session(
            reqCourseId,
            parseInt(batchId) || 0,
            date || ''
        );
        res.json({ success: true, data: results || [] });
    } catch (error) {
        console.error('Get_Attendance_Details_By_Session Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch attendance details', error: error.message });
    }
});

module.exports = router;
