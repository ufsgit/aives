const db = require('../config/dbconnection');
const emailHelper = require('./email-helper');
const emailLog = require('../models/email_log');
const { getOfficialContactInfo, isValidEmail } = require('./lead-welcome-helper');

/**
 * Automatically dispatches Registration Confirmation and Assigned Trainer emails to a registered student.
 * Uses template 'Welcome mail with receipt' (ID 19) and 'Assigned Staff' (ID 23) with built-in fallbacks.
 */
async function sendRegistrationConfirmationEmails({ studentId, courseId = null, batchId = null, slotId = null, req = null }) {
    try {
        const cleanStudentId = Number(studentId);
        if (!cleanStudentId || cleanStudentId <= 0) {
            console.log('[REGISTRATION EMAIL] Skipped: Invalid Student_ID.');
            return { success: false, reason: 'Invalid Student_ID' };
        }

        // 1. Fetch student information from database
        const [studentRows] = await db.promise().query(
            `SELECT Student_ID, First_Name, Last_Name, Email, Phone_Number, Country_Code, Roll_No, Roll_No_Character, 
                    Branch_Id, Branch_Name, Admission_Date, Registered_On, To_User_Id, To_User_Name, Is_Registered
             FROM student 
             WHERE Student_ID = ? AND (Delete_Status = 0 OR Delete_Status IS NULL) 
             LIMIT 1`,
            [cleanStudentId]
        );

        if (!studentRows || studentRows.length === 0) {
            console.warn(`[REGISTRATION EMAIL] Student ID ${cleanStudentId} not found in database.`);
            return { success: false, reason: 'Student not found' };
        }

        const student = studentRows[0];
        const studentEmail = (student.Email || '').trim();
        if (!studentEmail || !isValidEmail(studentEmail)) {
            console.log(`[REGISTRATION EMAIL] Skipped for Student ${cleanStudentId}: Missing or invalid email (${studentEmail}).`);
            return { success: false, reason: 'Invalid email' };
        }

        // 2. Prevent duplicate sends within 2 minutes
        try {
            const [recentLogs] = await db.promise().query(
                `SELECT Log_ID FROM email_logs 
                 WHERE (Student_ID = ? OR LOWER(TRIM(Email_Address)) = LOWER(TRIM(?)))
                   AND (Subject LIKE '%Enrolment Confirmation%' OR Subject LIKE '%Welcome mail with receipt%' OR Template_ID = 19)
                   AND Status = 'Success' 
                   AND Sent_At >= NOW() - INTERVAL 2 MINUTE 
                 LIMIT 1`,
                [cleanStudentId, studentEmail]
            );
            if (recentLogs && recentLogs.length > 0) {
                console.log(`[REGISTRATION EMAIL] Deduplication check: Registration email already sent recently to Student ${cleanStudentId} (${studentEmail}). Skipping.`);
                return { success: true, skipped: true, reason: 'Already sent recently' };
            }
        } catch (logErr) {
            console.warn('[REGISTRATION EMAIL] Warning checking existing email logs:', logErr.message);
        }

        // 3. Resolve Course, Batch, and Slot details
        let resolvedCourseId = Number(courseId) || 0;
        let resolvedBatchId = Number(batchId) || 0;
        let resolvedSlotId = Number(slotId) || 0;

        if (!resolvedCourseId || !resolvedBatchId) {
            try {
                const [scRows] = await db.promise().query(
                    `SELECT Course_ID, Batch_ID, Slot_Id 
                     FROM student_course 
                     WHERE Student_ID = ? AND (Delete_Status = 0 OR Delete_Status IS NULL) 
                     ORDER BY StudentCourse_ID DESC LIMIT 1`,
                    [cleanStudentId]
                );
                if (scRows && scRows.length > 0) {
                    if (!resolvedCourseId) resolvedCourseId = Number(scRows[0].Course_ID) || 0;
                    if (!resolvedBatchId) resolvedBatchId = Number(scRows[0].Batch_ID) || 0;
                    if (!resolvedSlotId) resolvedSlotId = Number(scRows[0].Slot_Id) || 0;
                }
            } catch (scErr) {
                console.warn('[REGISTRATION EMAIL] Error looking up student_course:', scErr.message);
            }
        }

        // Fetch Course Name
        let courseName = 'PTE Academic Training';
        if (resolvedCourseId > 0) {
            try {
                const [cRows] = await db.promise().query(
                    `SELECT Course_Name FROM course WHERE Course_ID = ? LIMIT 1`,
                    [resolvedCourseId]
                );
                if (cRows && cRows.length > 0 && cRows[0].Course_Name) {
                    courseName = cRows[0].Course_Name.trim();
                }
            } catch (cErr) {}
        }

        // Fetch Batch Timing and Schedule
        let batchTimeStr = '10:00 AM - 11:15 AM';
        let commencingDateStr = null;
        if (resolvedBatchId > 0) {
            try {
                const [bRows] = await db.promise().query(
                    `SELECT Batch_Name, Start_Time, End_Time, Commencing_Date FROM course_batch WHERE Batch_ID = ? LIMIT 1`,
                    [resolvedBatchId]
                );
                if (bRows && bRows.length > 0) {
                    const b = bRows[0];
                    if (b.Start_Time && b.End_Time) {
                        batchTimeStr = `${b.Start_Time} - ${b.End_Time}`;
                    }
                    if (b.Commencing_Date) {
                        commencingDateStr = new Date(b.Commencing_Date).toLocaleDateString('en-GB');
                    }
                }
            } catch (bErr) {}
        }

        // 4. Resolve Assigned Trainer / Staff details
        let trainerName = student.To_User_Name || 'Assigned Trainer';
        let trainerEmail = '';
        let trainerPhone = '';

        try {
            let staffUser = null;
            if (resolvedSlotId > 0) {
                const [slotStaff] = await db.promise().query(
                    `SELECT u.User_ID, u.First_Name, u.Last_Name, u.Email, u.PhoneNumber 
                     FROM teacher_time_slot tts 
                     JOIN course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID 
                     JOIN users u ON ct.Teacher_ID = u.User_ID 
                     WHERE tts.Slot_Id = ? AND IFNULL(tts.Delete_Status, 0) = 0 LIMIT 1`,
                    [resolvedSlotId]
                );
                if (slotStaff && slotStaff.length > 0) staffUser = slotStaff[0];
            }

            if (!staffUser && resolvedCourseId > 0) {
                const [courseStaff] = await db.promise().query(
                    `SELECT u.User_ID, u.First_Name, u.Last_Name, u.Email, u.PhoneNumber 
                     FROM course_teacher ct 
                     JOIN users u ON ct.Teacher_ID = u.User_ID 
                     WHERE ct.Course_ID = ? AND ct.Teacher_ID > 0 AND IFNULL(ct.Delete_Status, 0) = 0 LIMIT 1`,
                    [resolvedCourseId]
                );
                if (courseStaff && courseStaff.length > 0) staffUser = courseStaff[0];
            }

            if (!staffUser && student.To_User_Id > 0) {
                const [uRows] = await db.promise().query(
                    `SELECT User_ID, First_Name, Last_Name, Email, PhoneNumber FROM users WHERE User_ID = ? LIMIT 1`,
                    [student.To_User_Id]
                );
                if (uRows && uRows.length > 0) staffUser = uRows[0];
            }

            if (staffUser) {
                trainerName = `${staffUser.First_Name || ''} ${staffUser.Last_Name || ''}`.trim() || trainerName;
                trainerEmail = (staffUser.Email || '').trim();
                trainerPhone = (staffUser.PhoneNumber || '').trim();
            }
        } catch (trErr) {
            console.warn('[REGISTRATION EMAIL] Error finding assigned trainer:', trErr.message);
        }

        const trainerContact = trainerPhone ? `${trainerPhone} | ${trainerEmail}` : (trainerEmail || '+91 79944 43028');

        // 5. Resolve Fee & Receipt details
        let paidAmount = '0.00';
        let transactionId = '-';
        let currencySymbol = '₹';

        try {
            const [feeRows] = await db.promise().query(
                `SELECT Amount, Paid_Amount, Transaction_ID, Fee_Status, Currency 
                 FROM student_fees 
                 WHERE Student_ID = ? 
                 ORDER BY Student_Fees_ID DESC LIMIT 1`,
                [cleanStudentId]
            );
            if (feeRows && feeRows.length > 0) {
                const f = feeRows[0];
                const p = parseFloat(f.Paid_Amount || f.Amount || 0);
                paidAmount = p.toFixed(2);
                transactionId = f.Transaction_ID || '-';
                if (f.Currency === 'AUD') currencySymbol = 'A$';
                else if (f.Currency === 'USD') currencySymbol = '$';
            }
        } catch (feeErr) {}

        // 6. Contact Information & Common Placeholders
        const contactInfo = await getOfficialContactInfo(student.Branch_Id);
        const officialEmail = contactInfo.email || 'cs.mgr@testprepinenglish.com';
        const contactNumber = contactInfo.phone || '+91 79944 43028';

        const todayFormatted = new Date().toLocaleDateString('en-GB');
        const startDateFormatted = commencingDateStr || (student.Admission_Date ? new Date(student.Admission_Date).toLocaleDateString('en-GB') : todayFormatted);
        const studentFullName = `${student.First_Name || ''} ${student.Last_Name || ''}`.trim() || 'Student';
        const firstName = student.First_Name ? student.First_Name.trim() : studentFullName.split(' ')[0];
        const rollNo = student.Roll_No_Character || student.Roll_No || String(cleanStudentId);

        const placeholders = {
            'Student Name': studentFullName,
            'Student_Name': studentFullName,
            'First Name': firstName,
            'First_Name': firstName,
            'Lead Name': studentFullName,
            'Roll Number': rollNo,
            'Roll_No': rollNo,
            'Course Name': courseName,
            'Course_Name': courseName,
            'Programme': courseName,
            'Training Mode': student.Branch_Name || 'Online',
            'Enrolment Date': todayFormatted,
            'Start Date': startDateFormatted,
            'Course Commencement': startDateFormatted,
            'First Class Date': startDateFormatted,
            'Daily Training Time': batchTimeStr,
            'Time Zone': 'IST',
            'Payment Amount': `${currencySymbol} ${paidAmount}`,
            'Amount': `${currencySymbol} ${paidAmount}`,
            'Transaction ID': transactionId,
            'Trainer Name': trainerName,
            'Assigned Trainer': trainerName,
            'Trainer Contact Details': trainerContact,
            'Official Email': officialEmail,
            'Official_Email': officialEmail,
            'Contact Number': contactNumber,
            'Contact_Number': contactNumber
        };

        const replaceAllPlaceholders = (text) => {
            if (!text) return '';
            let res = text;
            Object.keys(placeholders).forEach(key => {
                const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                res = res.replace(new RegExp(`\\[${escaped}\\]`, 'gi'), placeholders[key]);
            });
            return res;
        };

        // =========================================================================
        // EMAIL 1: Registration Confirmation & Receipt
        // =========================================================================
        let receiptTemplate = null;
        try {
            const [rRows] = await db.promise().query(
                `SELECT Template_ID, Subject, Body FROM email_templates 
                 WHERE (Template_ID = 19 OR Template_Name LIKE '%receipt%' OR Template_Name LIKE '%Welcome mail with receipt%') 
                   AND (Delete_Status = 0 OR Delete_Status IS NULL) 
                 ORDER BY (Template_ID = 19) DESC, (Is_Active = 1) DESC LIMIT 1`
            );
            if (rRows && rRows.length > 0) receiptTemplate = rRows[0];
        } catch (e) {}

        const receiptSubject = receiptTemplate ? replaceAllPlaceholders(receiptTemplate.Subject) : `Enrolment Confirmation & Fee Receipt – ${courseName} | Aives Australia's TESTPREP`;
        const receiptRawBody = receiptTemplate?.Body || `Dear [First Name],

Welcome to Aives Australia's TESTPREP! We are delighted to confirm your enrolment in our [Course Name] programme.

Your Enrolment Details:
• Student Name: [Student Name]
• Roll Number: [Roll Number]
• Programme: [Course Name]
• Training Mode: [Training Mode]
• Course Commencement: [Start Date]
• Daily Training Time: [Daily Training Time] ([Time Zone])
• Payment Amount: [Payment Amount]
• Transaction Reference: [Transaction ID]

Our Student Support and Academic Team will guide you through every stage of your preparation. If you have any questions prior to class commencement, please reach out to us at [Official Email] or [Contact Number].

We wish you the very best in achieving your target score!

Warm regards,

Student Admissions & Administration Team
Aives Australia's TESTPREP
[Official Email] | [Contact Number]`;

        const receiptHtmlBody = replaceAllPlaceholders(receiptRawBody).replace(/\n/g, '<br>');
        console.log(`[REGISTRATION EMAIL] Sending Registration Confirmation to ${studentEmail} (Student ID ${cleanStudentId})...`);
        const sendReceiptRes = await emailHelper.sendEmail(studentEmail, receiptSubject, receiptHtmlBody, officialEmail, "Aives Australia's TESTPREP");

        await emailLog.Save_Email_Log(
            cleanStudentId,
            receiptTemplate?.Template_ID || 19,
            studentEmail,
            receiptSubject,
            sendReceiptRes?.messageId || null,
            receiptHtmlBody,
            'Success',
            null
        );
        console.log(`[REGISTRATION EMAIL] ✅ Registration confirmation email sent successfully to ${studentEmail}`);

        // =========================================================================
        // EMAIL 2: Trainer Allocation & Class Schedule (Assigned Staff)
        // =========================================================================
        let staffTemplate = null;
        try {
            const [sRows] = await db.promise().query(
                `SELECT Template_ID, Subject, Body FROM email_templates 
                 WHERE (Template_ID = 23 OR Template_Name LIKE '%assigned staff%' OR Template_Name LIKE '%assigned trainer%') 
                   AND (Delete_Status = 0 OR Delete_Status IS NULL) 
                 ORDER BY (Template_ID = 23) DESC, (Is_Active = 1) DESC LIMIT 1`
            );
            if (sRows && sRows.length > 0) staffTemplate = sRows[0];
        } catch (e) {}

        const staffSubject = staffTemplate ? replaceAllPlaceholders(staffTemplate.Subject) : `Trainer Allocation & Class Schedule – ${courseName} | Aives Australia's TESTPREP`;
        const staffRawBody = staffTemplate?.Body || `Dear [First Name],

Greetings from Aives Australia's TESTPREP!

We are pleased to inform you that your trainer has been allocated for the [Course Name] programme.

Trainer & Class Details:
• Assigned Trainer: [Trainer Name]
• Trainer Contact: [Trainer Contact Details]
• Batch Time: [Daily Training Time] ([Time Zone])
• First Class Date: [Start Date]

Your trainer will guide you throughout the training journey, conduct practice sessions, provide individual feedback, and assist you in achieving your required examination score.

Please be ready for your first session at the scheduled batch time. If you need any assistance, feel free to contact us at [Official Email] or [Contact Number].

Warm regards,

Academic Coordination Team
Aives Australia's TESTPREP
[Official Email] | [Contact Number]`;

        const staffHtmlBody = replaceAllPlaceholders(staffRawBody).replace(/\n/g, '<br>');
        console.log(`[REGISTRATION EMAIL] Sending Assigned Trainer email to ${studentEmail} (Trainer: ${trainerName})...`);
        const sendStaffRes = await emailHelper.sendEmail(studentEmail, staffSubject, staffHtmlBody, officialEmail, "Aives Australia's TESTPREP");

        await emailLog.Save_Email_Log(
            cleanStudentId,
            staffTemplate?.Template_ID || 23,
            studentEmail,
            staffSubject,
            sendStaffRes?.messageId || null,
            staffHtmlBody,
            'Success',
            null
        );
        console.log(`[REGISTRATION EMAIL] ✅ Assigned Trainer email sent successfully to ${studentEmail}`);

        return { success: true, studentEmail, courseName, trainerName };
    } catch (err) {
        console.error(`[REGISTRATION EMAIL] ❌ Error sending registration confirmation emails for Student ${studentId}:`, err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    sendRegistrationConfirmationEmails
};

