var express = require('express');
var router = express.Router();
var student = require('../models/student');
const nodemailer = require("nodemailer");
const axios = require('axios');
const https = require('https');
const emailHelper = require('../helpers/email-helper');
const emailLog = require('../models/email_log');
const { sendLeadWelcomeEmail } = require('../helpers/lead-welcome-helper');
const db = require('../config/dbconnection');

const brevoHttpsAgent = new https.Agent({
    keepAlive: false,
    maxCachedSessions: 0
});

// Send_Bulk_Email
router.post('/Send_Bulk_Email', async (req, res, next) => {
    try {
        const { students, subject, body, templateId, Sender_Email, Sender_Name } = req.body;
        const effectiveSenderEmail = Sender_Email || req.userEmail || null;
        const effectiveSenderName = Sender_Name || req.userName || null;
        console.log('Send_Bulk_Email received for', students?.length, 'students', 'Sender:', effectiveSenderEmail);

        if (!students || students.length === 0) {
            return res.status(400).json({ success: false, message: 'No students provided.' });
        }

        // Check template Is_Active before sending bulk emails
        if (templateId) {
            const [templateRows] = await db.promise().query(
                `SELECT Template_ID, Is_Active FROM email_templates WHERE Template_ID = ? AND Delete_Status = 0 LIMIT 1`,
                [templateId]
            );
            if (!templateRows || templateRows.length === 0) {
                console.log(`[Send_Bulk_Email] Template ID ${templateId} not found. Aborting bulk send.`);
                return res.status(404).json({ success: false, message: 'Email template not found. Bulk email not sent.' });
            }
            if (parseInt(templateRows[0].Is_Active) !== 1) {
                console.log(`[Send_Bulk_Email] Template ID ${templateId} is inactive. Aborting bulk send.`);
                return res.json({ success: true, skipped: true, message: 'Email template is inactive. Bulk email not sent.' });
            }
        }

        let successCount = 0;
        let failureCount = 0;
        let lastError = null;

        // Loop and send email
        for (const student of students) {
            if (student.Email) {
                try {
                    const response = await emailHelper.sendEmail(student.Email, subject, body.replace(/\n/g, '<br>'), effectiveSenderEmail, effectiveSenderName);
                    const messageId = response?.messageId || null;
                    await emailLog.Save_Email_Log(student.Student_ID, templateId || null, student.Email, subject, messageId, body, 'Success', null);
                    successCount++;
                } catch (emailError) {
                    console.error('Error sending email to', student.Email, emailError);
                    lastError = emailError.message || String(emailError);
                    await emailLog.Save_Email_Log(student.Student_ID, templateId || null, student.Email, subject, null, body, 'Failed', lastError);
                    failureCount++;
                }
            } else {
                await emailLog.Save_Email_Log(student.Student_ID, templateId || null, null, subject, null, body, 'Failed', 'No email address');
                failureCount++;
                lastError = 'No email address';
            }
        }

        if (successCount === 0 && failureCount > 0) {
            return res.status(400).json({ 
                success: false, 
                message: students.length === 1 ? `Failed to send email: ${lastError}` : 'Failed to send all emails.',
                error: lastError,
                details: { successCount, failureCount }
            });
        }

        res.json({ 
            success: true, 
            message: failureCount === 0 ? 'Bulk email sent successfully' : `Sent ${successCount} emails, but ${failureCount} failed.`,
            details: { successCount, failureCount, lastError: failureCount > 0 ? lastError : null }
        });
    } catch (e) {
        console.error('Send_Bulk_Email error:', e);
        res.status(500).json({ success: false, message: 'Failed to process bulk emails', error: e.message });
    }
});

// Get_Batch_Mail_Report
router.get('/Get_Batch_Mail_Report', async (req, res, next) => {
    try {
        const { courseId, batchId, fromDate, toDate } = req.query;
        const rows = await emailLog.Get_Batch_Mail_Report(
            parseInt(courseId) || 0,
            parseInt(batchId) || 0,
            fromDate || null,
            toDate || null
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error("Error fetching batch mail report:", err);
        res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
    }
});

// Get_Batch_Mail_Recipients
router.get('/Get_Batch_Mail_Recipients', async (req, res, next) => {
    try {
        const { courseId, batchId, subject, attendanceDate, sentDate } = req.query;
        let query = `
            SELECT DISTINCT
                el.Log_ID, 
                el.Student_ID, 
                CONCAT(IFNULL(s.First_Name, ''), ' ', IFNULL(s.Last_Name, '')) as Student_Name, 
                el.Email_Address, 
                el.Subject, 
                el.Status, 
                el.Sent_At, 
                el.Opened_At, 
                el.Error_Message 
            FROM email_logs el 
            LEFT JOIN student s ON el.Student_ID = s.Student_ID 
            JOIN attendance_details ad ON el.Student_ID = ad.Student_ID 
            JOIN attendance_master am ON ad.Attendance_ID = am.Attendance_ID 
                AND (
                    DATE(CONVERT_TZ(el.Sent_At, '+00:00', '+05:30')) = DATE(CONVERT_TZ(IFNULL(am.Created_Date, am.Attendance_Date), '+00:00', '+05:30'))
                    OR DATE(CONVERT_TZ(el.Sent_At, '+00:00', '+05:30')) = DATE(CONVERT_TZ(am.Attendance_Date, '+00:00', '+05:30'))
                    OR ABS(TIMESTAMPDIFF(HOUR, IFNULL(am.Created_Date, am.Attendance_Date), el.Sent_At)) <= 12
                )
            WHERE 1=1
        `;
        const params = [];
        if (courseId && parseInt(courseId) > 0) {
            query += ' AND am.Course_ID = ?';
            params.push(parseInt(courseId));
        }
        if (batchId && parseInt(batchId) > 0) {
            query += ' AND am.Batch_ID = ?';
            params.push(parseInt(batchId));
        }
        if (subject && subject.trim() !== '') {
            query += ' AND el.Subject = ?';
            params.push(subject.trim());
        }
        if (sentDate && sentDate.trim() !== '') {
            const cleanDate = sentDate.replace('T', ' ').replace('Z', '').substring(0, 10);
            query += ' AND DATE(CONVERT_TZ(el.Sent_At, "+00:00", "+05:30")) = DATE(?)';
            params.push(cleanDate);
        } else if (attendanceDate && attendanceDate.trim() !== '') {
            const cleanDate = attendanceDate.replace('T', ' ').replace('Z', '').substring(0, 10);
            query += ' AND (DATE(CONVERT_TZ(el.Sent_At, "+00:00", "+05:30")) = DATE(?) OR DATE(CONVERT_TZ(am.Attendance_Date, "+00:00", "+05:30")) = DATE(?))';
            params.push(cleanDate, cleanDate);
        }
        query += ' ORDER BY el.Sent_At DESC, el.Log_ID DESC';
        
        db.query(query, params, (err, rows) => {
            if (err) {
                console.error('Error fetching batch mail recipients:', err);
                return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
            }

            // Fallback: if no rows matched with strict attendance join but subject is provided, search email_logs directly for this batch/course students
            if ((!rows || rows.length === 0) && subject && subject.trim() !== '') {
                let fallbackQuery = `
                    SELECT DISTINCT
                        el.Log_ID, 
                        el.Student_ID, 
                        CONCAT(IFNULL(s.First_Name, ''), ' ', IFNULL(s.Last_Name, '')) as Student_Name, 
                        el.Email_Address, 
                        el.Subject, 
                        el.Status, 
                        el.Sent_At, 
                        el.Opened_At, 
                        el.Error_Message 
                    FROM email_logs el 
                    LEFT JOIN student s ON el.Student_ID = s.Student_ID 
                    WHERE el.Subject = ?
                `;
                const fbParams = [subject.trim()];
                if (sentDate || attendanceDate) {
                    const cleanDate = (sentDate || attendanceDate).replace('T', ' ').replace('Z', '').substring(0, 10);
                    fallbackQuery += ' AND DATE(CONVERT_TZ(el.Sent_At, "+00:00", "+05:30")) = DATE(?)';
                    fbParams.push(cleanDate);
                }
                fallbackQuery += ' ORDER BY el.Sent_At DESC, el.Log_ID DESC';
                return db.query(fallbackQuery, fbParams, (fbErr, fbRows) => {
                    if (fbErr) {
                        return res.json({ success: true, data: [] });
                    }
                    return res.json({ success: true, data: fbRows || [] });
                });
            }

            res.json({ success: true, data: rows });
        });
    } catch (e) {
        console.error('Error in Get_Batch_Mail_Recipients:', e);
        res.status(500).json({ success: false, message: 'Internal server error', error: e.message });
    }
});

// Get_Mail_Report
router.get('/Get_Mail_Report', async (req, res, next) => {
    try {
        let { fromDate, toDate, templateId } = req.query;
        
        // Ensure the entire end day is included by appending time
        if (toDate && toDate.trim() !== '') {
            toDate = `${toDate} 23:59:59`;
        }
        
        const rows = await emailLog.Get_Mail_Report(fromDate, toDate, templateId);
        res.json(rows);
    } catch (e) {
        console.error('Get_Mail_Report error:', e);
        res.status(500).json({ success: false, message: 'Failed to get mail report', error: e.message });
    }
});

// Get_Email_Logs_By_Student
router.get('/Get_Email_Logs_By_Student/:student_Id?', async (req, res, next) => {
    try {
        const rows = await emailLog.Get_Email_Logs_By_Student(req.params.student_Id);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get email logs', error: e.message });
    }
});

// Sync_Brevo_Opens — pulls delivery, open, click, and bounce events from Brevo Transactional Email API in bulk
router.post('/Sync_Brevo_Opens', async (req, res, next) => {
    try {
        const apiKeys = [];
        const mainKey = (process.env.BREVO_API_KEY || '').trim().replace(/^['\"]|['\"]$/g, '');
        const trainer2Key = (process.env.BREVO_API_KEY_TRAINER2 || '').trim().replace(/^['\"]|['\"]$/g, '');
        
        if (mainKey) apiKeys.push(mainKey);
        if (trainer2Key && trainer2Key !== mainKey) apiKeys.push(trainer2Key);

        if (!apiKeys.length) {
            return res.status(500).json({ success: false, message: 'No BREVO_API_KEY configured' });
        }

        let deliveredCount = 0;
        let openedCount = 0;
        let bouncedCount = 0;

        for (const apiKey of apiKeys) {
            try {
                let brevoRes = null;
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        brevoRes = await axios.get('https://api.brevo.com/v3/smtp/statistics/events', {
                            headers: {
                                'api-key': apiKey,
                                'accept': 'application/json'
                            },
                            params: {
                                limit: 100,
                                sort: 'desc',
                                days: 14
                            },
                            httpsAgent: brevoHttpsAgent,
                            timeout: 10000
                        });
                        break;
                    } catch (retryErr) {
                        if (attempt < 3 && (!retryErr.response || retryErr.code === 'EPROTO' || retryErr.code === 'ECONNRESET')) {
                            await new Promise(r => setTimeout(r, 500 * attempt));
                            continue;
                        }
                        throw retryErr;
                    }
                }

                const events = brevoRes?.data?.events || [];
                for (const ev of events) {
                    const rawMsgId = ev.messageId || '';
                    if (!rawMsgId) continue;
                    const cleanMsgId = rawMsgId.replace(/^<|>$/g, '');
                    const bracketedMsgId = rawMsgId.startsWith('<') ? rawMsgId : `<${rawMsgId}>`;
                    const eventType = (ev.event || '').toLowerCase();
                    const eventDate = ev.date ? new Date(ev.date).toISOString().slice(0, 19).replace('T', ' ') : null;
                    const recipientEmail = (ev.email || '').trim().toLowerCase();

                    if (eventType === 'delivered') {
                        const [u] = await db.promise().query(
                            `UPDATE email_logs 
                             SET Status = 'Delivered' 
                             WHERE (Message_ID IN (?, ?, ?) OR (LOWER(Email_Address) = ? AND ABS(TIMESTAMPDIFF(MINUTE, Sent_At, ?)) <= 60)) 
                               AND Status != 'Failed'`,
                            [rawMsgId, cleanMsgId, bracketedMsgId, recipientEmail, eventDate]
                        );
                        if (u.affectedRows > 0) deliveredCount += u.affectedRows;
                    } else if (eventType.includes('open') || eventType.includes('click')) {
                        const [u] = await db.promise().query(
                            `UPDATE email_logs 
                             SET Opened_At = IFNULL(Opened_At, ?),
                                 Status = CASE WHEN Status != 'Failed' THEN 'Delivered' ELSE Status END
                             WHERE (Message_ID IN (?, ?, ?) OR (LOWER(Email_Address) = ? AND ABS(TIMESTAMPDIFF(MINUTE, Sent_At, ?)) <= 60))`,
                            [eventDate, rawMsgId, cleanMsgId, bracketedMsgId, recipientEmail, eventDate]
                        );
                        if (u.affectedRows > 0) openedCount += u.affectedRows;
                    } else if (eventType.includes('bounce') || eventType.includes('block') || eventType.includes('deferred')) {
                        const [u] = await db.promise().query(
                            `UPDATE email_logs 
                             SET Status = 'Failed', Error_Message = ? 
                             WHERE (Message_ID IN (?, ?, ?) OR (LOWER(Email_Address) = ? AND ABS(TIMESTAMPDIFF(MINUTE, Sent_At, ?)) <= 60))`,
                            [ev.reason || eventType, rawMsgId, cleanMsgId, bracketedMsgId, recipientEmail, eventDate]
                        );
                        if (u.affectedRows > 0) bouncedCount += u.affectedRows;
                    }
                }
            } catch (keyErr) {
                console.warn(`[Sync_Brevo_Opens] Note for API key ${apiKey.substring(0, 10)}...:`, keyErr.response?.data?.message || keyErr.message);
            }
        }

        console.log(`[Sync_Brevo_Opens] Brevo sync finished: ${deliveredCount} delivered, ${openedCount} opened, ${bouncedCount} bounced.`);
        return res.json({
            success: true,
            delivered: deliveredCount,
            opened: openedCount,
            bounced: bouncedCount,
            message: `Brevo sync completed: ${deliveredCount} delivered, ${openedCount} opened, ${bouncedCount} bounced.`
        });
    } catch (e) {
        console.error('Sync_Brevo_Opens error:', e);
        res.status(500).json({ success: false, message: 'Failed to sync Brevo status', error: e.message });
    }
});



// Registration_Using_Student_Branch
router.post('/Registration_Using_Student_Branch', async (req, res, next) => {
    try {
        console.log("req.body: ", req.body);
        
        const rows = await student.Registration_Using_Student_Branch(req.body);       
        res.json(rows[0]);
    } catch (error) {       
        res.status(500).json({ error: 'Internal Server Error', message: error.sqlMessage });
    }
});

router.post('/Check_Uniqueness', async (req, res, next) => {
    try {
        const result = await student.Check_Uniqueness(req.body);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to check uniqueness', error: e.message });
    }
});
// Remove_Student_Registration
router.post('/Remove_Student_Registration', async (req, res, next) => {
    try {
        console.log("req.body: ", req.body);
        
        const rows = await student.Remove_Student_Registration(req.body);       
        res.json(rows[0]);
    } catch (error) {       
        res.status(500).json({ error: 'Internal Server Error', message: error.sqlMessage });
    }
});
// Get_All_Enquiry
router.get('/Get_All_Enquiry', async (req, res, next) => {
    try {
        const rows = await student.Get_All_Enquiry();
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to search student', error: e.message });
    }
});

router.post('/Save_Enquiry_Source/', async (req, res, next) => {
    try {
        const rows = await student.Save_Enquiry_Source(req.body);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to save enquiry source', error: e.message });
    }
});

router.post('/Delete_Enquiry_Source/', async (req, res, next) => {
    try {
        const rows = await student.Delete_Enquiry_Source(req.body.Enquiry_Source_Id);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to delete enquiry source', error: e.message });
    }
});
router.post('/Save_student/', async (req, res, next) => {
    try {
        if (!req.body.Registered_By && req.userId) {
            req.body.Registered_By = req.userId;
        }
        if (!req.body.Created_By && req.userId) {
            req.body.Created_By = req.userId;
        }
        if ((!req.body.Assigned_Staff_ID || Number(req.body.Assigned_Staff_ID) === 0) && req.userId) {
            req.body.Assigned_Staff_ID = req.userId;
            req.body.Assigned_Staff_Name = req.userName || '';
        }
        const rows = await student.Save_student(req.body);
        const firstResult = rows && (rows[0]?.[0] || rows[0]);
        const existingUserVal = firstResult?.existingUser !== undefined 
            ? Number(firstResult.existingUser) 
            : (rows?.[0]?.existingUser !== undefined ? Number(rows[0].existingUser) : 0);

        // If newly created lead (existingUser === 0) and not an edit (Student_ID == 0)
        const isNewStudent = (!req.body.Student_ID || Number(req.body.Student_ID) === 0) && existingUserVal === 0;
        const newStudentId = firstResult?.Student_ID || rows?.[0]?.Student_ID || (rows?.[0]?.[0] && rows[0][0].Student_ID) || null;
        const studentEmail = (req.body.Email || '').trim();

        // Do not send Lead Welcome Email if the user is being registered simultaneously
        const isRegistrationFlow = req.body.Is_Registered == 1 || req.body.Is_Registered === true || req.body.Is_Registered === '1' ||
                                   req.body.isRegistered == 1 || req.body.isRegistered === true || req.body.isRegistered === '1' ||
                                   req.body.isRegistering == 1 || req.body.isRegistering === true || req.body.isRegistering === '1';
        
        console.log("Save_student Email Debug - isNewStudent:", isNewStudent, "newStudentId:", newStudentId, "studentEmail:", studentEmail, "isRegistrationFlow:", isRegistrationFlow);
        console.log("req.body registration flags - Is_Registered:", req.body.Is_Registered, "isRegistered:", req.body.isRegistered, "isRegistering:", req.body.isRegistering);

        if (isNewStudent && newStudentId && studentEmail && !isRegistrationFlow) {
            const studentName = `${req.body.First_Name || ''} ${req.body.Last_Name || ''}`.trim();
            const studentPhone = `${req.body.Country_Code || ''} ${req.body.Phone_Number || ''}`.trim();
            let loggedInSenderEmail = req.userEmail || req.body?.Sender_Email || null;
            let loggedInSenderName = req.userName || req.body?.Sender_Name || null;
            if (loggedInSenderEmail && (loggedInSenderEmail.toLowerCase() === 'admin_user@g.com' || loggedInSenderEmail.toLowerCase() === 'admin_user')) {
                loggedInSenderEmail = 'cs.mgr@testprepinenglish.com';
            }
            sendLeadWelcomeEmail({
                studentId: newStudentId,
                name: studentName,
                email: studentEmail,
                phone: studentPhone,
                req: req,
                senderEmail: loggedInSenderEmail,
                senderName: loggedInSenderName
            }).catch(err => console.error('[Save_student] Welcome email error:', err));
        }

        res.json(rows);
    }
    catch (e) {
        console.log('e: ', e);
        res.status(500).json({ success: false, message: 'Failed to save student', error: e.message });
    }
});

router.get('/Lead_Response/:studentId', async (req, res) => {
    try {
        const studentId = parseInt(req.params.studentId);
        const data = await student.Get_Lead_Response(studentId);
        res.json({ success: true, hasResponded: !!data, data });
    } catch (e) {
        console.error('Error in Get_Lead_Response:', e);
        res.status(500).json({ success: false, message: 'Failed to get lead response', error: e.message });
    }
});

// Save_User_Permission
router.post('/Save_User_Permission/', async (req, res) => {
    try {
        const rows = await student.Save_User_Permission(req.body);
        console.log("rows",rows);
        
        res.json({ success: true, data: rows });
    } catch (e) {
        console.error('Error in Save_student_followup:', e);
        res.status(500).json({ success: false, message: 'Failed to save follow-up', error: e.message });
    }
});
router.post('/Save_student_followup/', async (req, res) => {
    try {
        if (!req.body.Created_By && req.userId) {
            req.body.Created_By = req.userId;
        }
        if ((!req.body.Assigned_Staff_ID || Number(req.body.Assigned_Staff_ID) === 0) && req.userId) {
            req.body.Assigned_Staff_ID = req.userId;
            req.body.Assigned_Staff_Name = req.userName || '';
        }
        const rows = await student.Save_student_followup(req.body);
        res.json({ success: true, data: rows });
    } catch (e) {
        console.error('Error in Save_student_followup:', e);
        res.status(500).json({ success: false, message: 'Failed to save follow-up', error: e.message });
    }
});
router.post('/enroleCourse/', async (req, res, next) => {
    try {
        console.log('req.body: ', req.body);
        const rows = await student.enroleCourse(req.body);
        res.json(rows);
        console.log('rows: ', rows);

        const recepients = ["work@ufstechnologies.com", "cristine@ufstechnologies.com" ]
        
        const enrollmentHtml = `
            <p>Hello,</p>
            <p>A new student has enrolled. Below are the details:</p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Student Name</th>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${rows[0].student_Name_}</td>
                </tr>
                <tr>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Course Name</th>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${rows[0].course_Name_}</td>
                </tr>
            </table>
        `;

        for (const recipient of recepients) {
            try {
                await emailHelper.sendEmail(recipient, 'New Student Enrolled', enrollmentHtml);
            } catch (err) {
                console.error(`Error sending enrollment notification to ${recipient}:`, err);
            }
        }
    }
    catch (e) {
        console.log('e: ', e);
        res.status(500).json({ success: false, message:  e.message, error: e.message });
    }
});
router.post('/Buy_Course/', async (req, res, next) => {
    try {
        const rows = await student.Buy_Course(req.body);
        res.json(rows);
        console.log('rows: ', rows);

        let transporter = nodemailer.createTransport({
            host: "smtp-relay.brevo.com",
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: "7a9d83001@smtp-brevo.com", // generated brevo user
                pass: "2bNEKDBCd7JytLIH", // generated brevo password
            },
            tls: {
                rejectUnauthorized: true
            }
        });

        const recepients = ["work@ufstechnologies.com", "cristine@ufstechnologies.com" ]
        
        const msg = {
            from: "info@IGMacademy.in",
            to: recepients,
            subject: 'New Student Enrolled',
            html: `
            
            <br/>Hello, <br/>
            <p>A new student has enrolled. Below are the details:</p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Student Name</th>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${rows[0].student_Name_}</td>
            </tr>
            <tr>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Course Name</th>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${rows[0].course_Name_}</td>
            </tr>
      
            </table>
            <br/>`,


        };

        const sendMailPromise = () => {
            return new Promise((resolve, reject) => {
                transporter.sendMail(msg, function (err, info) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(info);
                    }
                });
            });
        };


        // await sendMailPromise();
    }
    catch (e) {
        console.log('e: ', e);
        res.status(500).json({ success: false, message:  e.message, error: e.message });
    }
});
router.post('/enroleCourseFromAdmin/', async (req, res, next) => {
    try {
        console.log('req.body: of enroleCourseFromAdmin', req.body);
        const rows = await student.enroleCourseFromAdmin(req.body);
        res.json(rows);
        //console.log('rows: ', rows);

        let transporter = nodemailer.createTransport({
            host: "smtp-relay.brevo.com",
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: "7a9d83001@smtp-brevo.com", // generated brevo user
                pass: "2bNEKDBCd7JytLIH", // generated brevo password
            },
            tls: {
                rejectUnauthorized: true
            }
        });

        const recepients = ["work@ufstechnologies.com", "cristine@ufstechnologies.com" ]
        
        const msg = {
            from: "info@IGMacademy.in",
            to: recepients,
            subject: 'New Student Enrolled',
            html: `
            
            <br/>Hello, <br/>
            <p>A new student has enrolled. Below are the details:</p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Student Name</th>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${rows[0].student_Name_}</td>
            </tr>
            <tr>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Course Name</th>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${rows[0].course_Name_}</td>
            </tr>
      
            </table>
            <br/>`,


        };

        const sendMailPromise = () => {
            return new Promise((resolve, reject) => {
                transporter.sendMail(msg, function (err, info) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(info);
                    }
                });
            });
        };


        // await sendMailPromise();
    }
    catch (e) {
        console.log('e: ', e);
        res.status(500).json({ success: false, message:  e.message, error: e.message });
    }
});
router.get('/Search_student/', async (req, res, next) => {
  try {
    const userId = req.userId || req.query.userId || req.query.staffId || null;
    const userTypeId = req.userTypeId || req.query.userTypeId || null;
    const rows = await student.Search_student(
      req.query.student_Name,
      req.query.page,
      req.query.pageSize,
      req.query.courseId,
      req.query.batchId,
      req.query.enrollment_status,
      req.query.activeStatus,
      req.query.filter_subscribed,
      req.query.filter_roll_number,
      userId,
      userTypeId
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to search student', error: e.message });
  }
});
// Search_student_lead
router.get('/Search_student_lead/', async (req, res, next) => {
    try {
        console.log("req.query",req.query);
        
        const rows = await student.Search_student_lead(req.query.student_Name,req.query.page,req.query.pageSize,req.query.courseId,req.query.batchId,req.query.enrollment_status,req.query.activeStatus,req.query.branchId,req.query.assignedStaffId,req.query.enquirySourceId,req.userId,req.userTypeId,req.query.priority);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to search student', error: e.message });
    }
});

router.get('/Get_Registration_Report/', async (req, res, next) => {
    try {
        console.log("Get_Registration_Report query", req.query);
        const rows = await student.Get_Registration_Report(
            req.query.student_Name,
            req.query.page,
            req.query.pageSize,
            req.query.courseId,
            req.query.batchId,
            req.query.enrollment_status,
            req.query.activeStatus,
            req.query.fromDate,
            req.query.toDate,
            req.query.enrolledById
        );
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to search student', error: e.message });
    }
});

router.get('/Get_Registration_Summary/', async (req, res, next) => {
    try {
        const rows = await student.Get_Registration_Summary(
            req.query.fromDate,
            req.query.toDate
        );
        res.json(rows[0]);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get registration summary', error: e.message });
    }
});

// Get Unassigned Excel Leads
router.get('/Get_Unassigned_Excel_Leads/', async (req, res, next) => {
    try {
        const rows = await student.Get_Unassigned_Excel_Leads();
        res.json({ success: true, data: rows });
    } catch (e) {
        console.error('Error in Get_Unassigned_Excel_Leads:', e);
        res.status(500).json({ success: false, message: 'Failed to fetch unassigned leads', error: e.message });
    }
});

// Take Excel Lead
router.post('/Take_Excel_Lead/', async (req, res, next) => {
    try {
        const { studentId, staffId, staffName } = req.body;
        const rows = await student.Take_Excel_Lead(studentId, staffId, staffName);
        res.json({ success: true, message: 'Lead assigned successfully', data: rows });
    } catch (e) {
        console.error('Error in Take_Excel_Lead:', e);
        res.status(500).json({ success: false, message: 'Failed to assign lead', error: e.message });
    }
});

router.get('/Get_All_Students/', async (req, res, next) => {
    try {
        const rows = await student.Get_All_Students(req.query.student_Name);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to search student', error: e.message });
    }
});

router.get('/Get_student/:student_Id_?', async (req, res, next) => {
    try {
        const rows = await student.Get_student(req.params.student_Id_, req.query.is_Student);
        console.log('rows: ', rows);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get student', error: e.message });
    }
});

router.get('/Get_Courses_By_StudentId/:student_Id_?', async (req, res, next) => {
    try {
        const rows = await student.Get_Courses_By_StudentId(req.params.student_Id_,req.query.course_Name,req.query.priceFrom ,req.query.priceTo);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});

router.get('/GetAllCourses/', async (req, res, next) => {
    try {
        console.log('req.query.course_Type: ', req.query.course_Type);
        console.log('req.userId: ', req.userId);
        const rows = await student.GetAllCourses(req.query.course_Type, req.userId,req.query.priceFrom ,req.query.priceTo);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});
// Get_DocumentTypes
router.get('/Get_DocumentTypes/', async (req, res, next) => {
    try {

        const rows = await student.Get_DocumentTypes();
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});
router.get('/Search_Occupations/', async (req, res, next) => {
    try {
        const rows = await student.Search_Occupations();
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});
router.get('/Branch_Dropdown/', async (req, res, next) => {
    try {
        const rows = await student.Branch_Dropdown(); // should return both result sets
        res.json(rows);
        console.log('rows: ', rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});

router.get('/User_Dropdown/', async (req, res, next) => {
    try {
        const rows = await student.User_Dropdown(); // should return both result sets
        res.json(rows);
        //console.log('rows: ', rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});


router.get('/Department_Dropdown/', async (req, res, next) => {
    try {
        const rows = await student.Department_Dropdown(); // should return both result sets
        res.json(rows);
        console.log('rows: ', rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});
router.get('/loadBatches/', async (req, res, next) => {
    try {
        const rows = await student.course_batch_Dropdown(); // should return both result sets
        res.json(rows);
        console.log('rows: ', rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});
router.get('/Course_Dropdown/', async (req, res, next) => {
    try {
        const rows = await student.Course_Dropdown(); // should return both result sets
        res.json(rows);
        console.log('rows: ', rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});

router.get('/Get_StudentDocuments/:studentId', async (req, res) => {
  const studentId = parseInt(req.params.studentId, 10);

  try {
     const rows = await student.Get_StudentDocuments(studentId); // should return both result sets
        res.json(rows);
        console.log('rows: ', rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});


router.post('/save_DocumentMetadata', async (req, res) => {
  try {

     const rows = await student.save_DocumentMetadata(req.body); // should return both result sets
        res.json(rows);
        console.log('rows: ', rows);

   

    // res.json({ success: true, message: 'Document saved successfully' });
  } catch (err) {
    console.error('Error saving document:', err);
    res.status(500).json({ success: false, message: 'DB Error', error: err.message });
  }
});

router.get('/student/Get_StudentDocuments/:studentId', async (req, res) => {
  const studentId = parseInt(req.params.studentId, 10);

  try {
    const [result] = await db.query('CALL Get_StudentDocuments(?)', [studentId]);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error fetching documents:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch documents' });
  }
});



router.post('/Delete_Student_Account/:student_Id?', async (req, res, next) => {
    try {
        const rows = await student.Delete_Student_Account(req.params.student_Id?req.params.student_Id:req.userId);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});
// Delete_StudentDocument
router.post('/Delete_StudentDocument/:documentId', async (req, res) => {
  try {
    const documentId = req.params.documentId;
    const rows = await student.Delete_StudentDocument(documentId);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete document',
      error: e.message,
    });
  }
});

router.get('/CheckStudentEnrollment/?:course_Id', async (req, res, next) => {
    try {
        const rows = await student.CheckStudentEnrollment(req.userId,req.params.course_Id);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});

router.get('/Get_Courses_By_Category/:category_Id_?', async (req, res, next) => {
    try {
        const rows = await student.Get_Courses_By_Category(req.params.category_Id_);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});
router.get('/Get_student_followup_history/:student_Id_?', async (req, res, next) => {
    try {
        const rows = await student.Get_student_followup_history(req.params.student_Id_);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});
router.get('/Get_student_current_followup/:student_Id_?', async (req, res, next) => {
    try {
        const rows = await student.Get_student_current_followup(req.params.student_Id_);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});
router.get('/GetEnrolledCourses/:student_Id_?', async (req, res, next) => {
    try {
        const rows = await student.GetEnrolledCourses(req.params.student_Id_);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});
router.post('/SaveChatMessage/', async (req, res, next) => {
    try {
        const rows = await student.Save_chat_message(req.body);
        res.json(rows);


        
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to save message', error: e.message });
    }
});
router.post('/Save_Occupation/', async (req, res, next) => {
    try {
        console.log('req.body: ', req.body);
        const rows = await student.Save_Occupation(req.body);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to save message', error: e.message });
    }
});
router.post('/Save_Followup_Status/', async (req, res, next) => {
    try {
        const rows = await student.Save_Followup_Status(req.body);
        res.json(rows[0]);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to save follow-up status', error: e.message });
    }
});

router.post('/Save_Call_Log/', async (req, res, next) => {
    try {
        console.log('[Save_Call_Log] req.body:', req.body);
        
        // Check if it's a batch sync from mobile app (Array)
        if (Array.isArray(req.body)) {
            const result = await student.Save_Call_Logs_Batch(req.body);
            return res.json({
                status: 'success',
                message: `${result.savedCount} logs saved successfully`,
                total_received: result.totalReceived
            });
        }

        const { Student_ID } = req.body;
        if (!Student_ID || Student_ID === 0) {
            return res.status(400).json({ success: false, message: 'Student_ID is required and cannot be null or zero.' });
        }
        const rows = await student.Save_Call_Log(req.body);
        res.json(rows);
    }
    catch (e) {
        console.error('[Save_Call_Log] Error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to save call log', error: e.message });
    }
});
router.get('/Get_Followup_Status/', async (req, res, next) => {
    try {
        const rows = await student.Get_Followup_Status();
        res.json(rows[0]);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get follow-up status', error: e.message });
    }
});
router.post('/Delete_Followup_Status/', async (req, res, next) => {
    try {
        const rows = await student.Delete_Followup_Status(req.body.Status_Id);
        res.json(rows[0]);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to delete follow-up status', error: e.message });
    }
});
router.post('/Bulk_Student_Import/', async (req, res, next) => {
    try {
        console.log('req.body: ', req.body.students);
        const rows = await student.Bulk_Student_Import(req.body.students);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to save message', error: e.message });
    }
});
router.post('/BulkImportInstallmentsBatch/', async (req, res, next) => {
    try {
        console.log('req.body: ', req.body.students);
        const rows = await student.BulkImportInstallmentsBatch(req.body.students);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to save message', error: e.message });
    }
});

router.post('/saveAllEnrollments/', async (req, res, next) => {
    try {
        console.log('req.body: ', req.body.students);
        const rows = await student.saveAllEnrollments(req.body.students);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to save message', error: e.message });
    }
});
router.post('/Insert_Student_Exam_Result/', async (req, res, next) => {
    try {
        console.log('req.body: ', req.body);
        const rows = await student.Insert_Student_Exam_Result(req.body);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to insert exam result', error: e.message });
    }
});

router.post('/Update_Student_LastOnline/', async (req, res, next) => {
    try {
        console.log('req.body: ', req.body);
        const rows = await student.Update_Student_LastOnline(req.userId,req.body.Last_Online);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to save message', error: e.message });
    }
});
router.get('/Get_Chat_With_Bot/:student_Id_?', async (req, res, next) => {
    try {
        const rows = await student.Get_Chat_With_Bot(req.params.student_Id_);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get chat history', error: e.message });
    }
});


router.get('/get_student_fees_details/:student_Id_?', async (req, res, next) => {
    try {
        const rows = await student.get_student_fees_details(req.params.student_Id_);
        // console.log('rows: ', rows);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get data', error: e.message });
    }
});

router.get('/delete_Student_Exam_result/:StudentExam_ID?', async (req, res, next) => {
    try {
        const rows = await student.delete_Student_Exam_result(req.params.StudentExam_ID);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get chat history', error: e.message });
    }
});

router.get('/Get_Live_Classes_By_CourseId/:course_Id_?/:Batch_Id_?', async (req, res, next) => {
    try {
        console.log('req.userId: ', req.userId);
        const rows = await student.Get_Live_Classes_By_CourseId(req.params.course_Id_,req.userId,req.params.Batch_Id_);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get live classes', error: e.message });
    }
});
router.get('/Get_Recorded_LiveClasses/:Batch_Id_?', async (req, res, next) => {
    try {
        console.log('req.userId: ', req.userId);
        const rows = await student.Get_Recorded_LiveClasses(req.userId,req.params.Batch_Id_);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get live classes', error: e.message });
    }
});
router.get('/Get_Student_Exam_Results', async (req, res) => {
    const { studentId, courseId } = req.query; // Assuming you're passing the IDs as query parameters
    try {
        const results = await student.Get_Student_Exam_Results(studentId,courseId);

        res.json(results);
    } catch (error) {
        console.error('Error fetching exam results:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch exam results', error: error.message });
    }
});

router.get('/Get_Available_Mentors/', async (req, res, next) => {
    try {
        const rows = await student.Get_Available_Mentors(req.userId);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get Get_Available_Mentors', error: e.message });
    }
});
router.get('/Get_Available_Hod/', async (req, res, next) => {
    try {
        const rows = await student.Get_Available_Hod(req.userId);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get Get_Available_Hod', error: e.message });
    }
});
router.get('/Generate_certificate/:StudentCourse_ID/:value', async (req, res, next) => {
    try {
        const rows = await student.Generate_certificate(req.params.StudentCourse_ID,req.params.value);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get Generate certificate', error: e.message });
    }
});

router.get('/Get_Dashboard_Data/', async (req, res, next) => {
    try {
        const rows = await student.Get_Dashboard_Data_By_StudentId(req.userId);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get dashboard data', error: e.message });
    }
});

router.get('/Get_ExamDetails_By_StudentId/', async (req, res, next) => {
    try {
        const rows = await student.Get_ExamDetails_By_StudentId(req.query.student_Id, req.query.exam_Id);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get exam data', error: e.message });
    }
});

router.post('/Save_AppInfo/', async (req, res, next) => {
    try {
        const appInfo = {
            user_id: req.userId,
            isStudent: req.isStudent,
            ...req.body
        };
        const rows = await student.Save_AppInfo(appInfo);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to save app info', error: e.message });
    }
});

router.get('/Get_AppInfo_List/', async (req, res, next) => {
    try {
        const filters = {
            isStudent: req.query.isStudent,
            appVersion: req.query.appVersion || '',
            nameSearch: req.query.nameSearch || '', 
            fromDate: req.query.fromDate || null,
            toDate: req.query.toDate || null,
            isBatteryOptimized: req.query.isBatteryOptimized || -1, // New battery optimization filter
            page: parseInt(req.query.page) || 1,
            pageSize: parseInt(req.query.pageSize) || 10
        };
        const rows = await student.Get_AppInfo_List(filters);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get app info list', error: e.message });
    }
});
router.get('/Followup_status_Dropdown/', async (req, res, next) => {
    try {
        const rows = await student.Followup_status_Dropdown(); // should return both result sets
        res.json(rows);
        //console.log('rows: ', rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get courses', error: e.message });
    }
});

router.get('/Get_Enquiry_Summary/', async (req, res, next) => {
    try {
        let { fromDate, toDate } = req.query;

        // Ensure the entire end day is included by appending time
        if (toDate && toDate.trim() !== '') {
            toDate = `${toDate} 23:59:59`;
        }

        const rows = await student.Get_Enquiry_Summary(fromDate, toDate);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get enquiry summary', error: e.message });
    }
});

router.get('/Get_Status_Report/', async (req, res, next) => {
    try {
        const { fromDate, toDate } = req.query;
        const rows = await student.Get_Status_Count_Report(fromDate, toDate);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get status report', error: e.message });
    }
});

router.get('/Get_Lead_Dashboard_Summary/', async (req, res, next) => {
    try {
        const { fromDate, toDate, staffId } = req.query;
        const result = await student.Get_Lead_Dashboard_Summary(fromDate, toDate, staffId);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get lead dashboard summary', error: e.message });
    }
});

router.get('/Get_Today_Followups/', async (req, res, next) => {
    try {
        const rows = await student.Get_Today_Followups();
        res.json(rows);
    } catch (e) {
        console.error('Error in Get_Today_Followups:', e);
        res.status(500).json({ success: false, message: 'Failed to get today follow-ups', error: e.message });
    }
});

router.get('/Get_Pending_Followups/', async (req, res, next) => {
    try {
        const rows = await student.Get_Pending_Followups();
        res.json(rows);
    } catch (e) {
        console.error('Error in Get_Pending_Followups:', e);
        res.status(500).json({ success: false, message: 'Failed to get pending follow-ups', error: e.message });
    }
});

router.get('/Get_Interested_Leads/', async (req, res, next) => {
    try {
        const rows = await student.Get_Interested_Leads();
        res.json(rows);
    } catch (e) {
        console.error('Error in Get_Interested_Leads:', e);
        res.status(500).json({ success: false, message: 'Failed to get interested leads', error: e.message });
    }
});

module.exports = router;

