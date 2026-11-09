const db = require('../config/dbconnection');
const emailHelper = require('./email-helper');
const emailLog = require('../models/email_log');
const { getOfficialContactInfo, isValidEmail } = require('./lead-welcome-helper');
const PDFDocument = require('pdfkit');

/**
 * Generates a payment receipt PDF as a base64 string using pdfkit.
 * Mirrors the layout produced by the frontend generateReceiptPDFBase64 method.
 */
function generateReceiptPDFBase64({ student, feeData, currencySymbol }) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 40 });
            const buffers = [];
            doc.on('data', chunk => buffers.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer.toString('base64'));
            });
            doc.on('error', reject);

            const pageWidth = doc.page.width;
            const margin = 40;

            // ── Header ──────────────────────────────────────────────────
            doc.font('Helvetica-Bold').fontSize(16)
               .text('AIVES Australia Testprep', margin, 40, { align: 'left' });

            doc.font('Helvetica').fontSize(8)
               .text(
                   'Address: 2nd Floor, Geo Centre, Door No. 45, 1920 B3, NH-66, Chakkaraparambu, Vennala, Ernakulam, Kerala 682032',
                   margin, 60, { width: pageWidth - margin * 2 }
               );

            doc.moveTo(margin, 82).lineTo(pageWidth - margin, 82).lineWidth(0.5).stroke();

            // ── Title ───────────────────────────────────────────────────
            doc.font('Helvetica-Bold').fontSize(13)
               .text('PAYMENT RECEIPT', margin, 90, { align: 'center', width: pageWidth - margin * 2 });

            // ── Student / Payment Details ────────────────────────────────
            const studentName = `${student.First_Name || ''} ${student.Last_Name || ''}`.trim() || 'Student';
            const phone = student.Phone_Number || student.MobileNo || '-';
            const course = feeData.Course_Name || '-';
            const transactionId = feeData.Transaction_ID || '-';
            const paymentMode = feeData.Payment_Mode || '-';
            const paymentDate = feeData.Payment_Date
                ? new Date(feeData.Payment_Date).toLocaleDateString('en-GB')
                : new Date().toLocaleDateString('en-GB');

            const detailsY = 112;
            const col1 = margin;
            const col2 = margin + 120;
            const col3 = margin + 290;
            const col4 = margin + 400;

            doc.font('Helvetica-Bold').fontSize(10).text('Student Name:', col1, detailsY);
            doc.font('Helvetica').fontSize(10).text(studentName, col2, detailsY);
            doc.font('Helvetica-Bold').text('Payment Date:', col3, detailsY);
            doc.font('Helvetica').text(paymentDate, col4, detailsY);

            doc.font('Helvetica-Bold').fontSize(10).text('Phone Number:', col1, detailsY + 18);
            doc.font('Helvetica').fontSize(10).text(phone, col2, detailsY + 18);
            doc.font('Helvetica-Bold').text('Course:', col3, detailsY + 18);
            doc.font('Helvetica').text(course, col4, detailsY + 18, { width: pageWidth - col4 - margin });

            doc.font('Helvetica-Bold').fontSize(10).text('Transaction ID:', col1, detailsY + 36);
            doc.font('Helvetica').fontSize(10).text(transactionId, col2, detailsY + 36);
            doc.font('Helvetica-Bold').text('Payment Mode:', col3, detailsY + 36);
            doc.font('Helvetica').text(paymentMode, col4, detailsY + 36);

            // ── Payment Breakdown Table ──────────────────────────────────
            const tableY = detailsY + 70;
            const tableWidth = pageWidth - margin * 2;
            const colWidths = [tableWidth * 0.65, tableWidth * 0.35];

            // Header row
            doc.rect(col1, tableY, colWidths[0], 20).fill('#337ab7');
            doc.rect(col1 + colWidths[0], tableY, colWidths[1], 20).fill('#337ab7');
            doc.font('Helvetica-Bold').fontSize(10).fillColor('white')
               .text('Description', col1 + 5, tableY + 5, { width: colWidths[0] - 10 });
            doc.text('Amount', col1 + colWidths[0] + 5, tableY + 5, { width: colWidths[1] - 10 });

            const paidAmount = Number(feeData.Paid_Amount || feeData.Amount || 0);
            const fineAmount = Number(feeData.Fine_Amount || 0);
            const totalAmount = paidAmount + fineAmount;

            const rows = [['Fee Amount', `${currencySymbol} ${paidAmount.toFixed(2)}`]];
            if (fineAmount > 0) rows.push(['Late Fine Applied', `${currencySymbol} ${fineAmount.toFixed(2)}`]);
            rows.push(['Total Amount Paid', `${currencySymbol} ${totalAmount.toFixed(2)}`]);

            let rowY = tableY + 20;
            rows.forEach((row, idx) => {
                const isTotalRow = idx === rows.length - 1;
                const bg = idx % 2 === 0 ? '#f9f9f9' : '#ffffff';
                doc.rect(col1, rowY, colWidths[0], 18).fill(bg).stroke('#dddddd');
                doc.rect(col1 + colWidths[0], rowY, colWidths[1], 18).fill(bg).stroke('#dddddd');
                const font = isTotalRow ? 'Helvetica-Bold' : 'Helvetica';
                doc.font(font).fontSize(10).fillColor('black')
                   .text(row[0], col1 + 5, rowY + 4, { width: colWidths[0] - 10 });
                doc.font(font).text(row[1], col1 + colWidths[0] + 5, rowY + 4, { width: colWidths[1] - 10 });
                rowY += 18;
            });

            // ── Terms & Conditions ───────────────────────────────────────
            const termsY = rowY + 18;
            doc.font('Helvetica-Bold').fontSize(9).fillColor('black').text('Terms and Conditions:', margin, termsY);
            doc.font('Helvetica').fontSize(8)
               .text('1. This receipt is subject to realisation of cheque.', margin, termsY + 14)
               .text('2. This receipt should be carefully preserved and produced on demand.', margin, termsY + 22)
               .text('3. Fees once paid are non-refundable/non-transferable under any circumstances.', margin, termsY + 30);

            // ── Footer statement ─────────────────────────────────────────
            doc.font('Helvetica').fontSize(9).fillColor('black')
               .text(
                   'This is a computer-generated payment receipt and does not require a signature.',
                   margin, termsY + 50,
                   { align: 'center', width: pageWidth - margin * 2 }
               );

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

// Shared in-memory registration locks & history to guarantee EXACTLY ONE send per registration
const activeRegistrationLocks = new Map(); // key -> timestamp
const sentRegistrationHistory = new Map(); // key -> timestamp

const LOCK_TIMEOUT_MS = 60 * 1000; // 60 seconds active lock duration
const HISTORY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes deduplication window

function isRegistrationLocked(studentId, email = null) {
    const now = Date.now();
    const cleanId = Number(studentId);
    const sKey = (cleanId && cleanId > 0) ? `std_${cleanId}` : null;
    const eKey = email ? `email_${String(email).trim().toLowerCase()}` : null;

    // 1. Check active in-flight locks
    if (sKey && activeRegistrationLocks.has(sKey)) {
        if (now - activeRegistrationLocks.get(sKey) < LOCK_TIMEOUT_MS) return true;
        activeRegistrationLocks.delete(sKey);
    }
    if (eKey && activeRegistrationLocks.has(eKey)) {
        if (now - activeRegistrationLocks.get(eKey) < LOCK_TIMEOUT_MS) return true;
        activeRegistrationLocks.delete(eKey);
    }

    // 2. Check recent completed send history
    if (sKey && sentRegistrationHistory.has(sKey)) {
        if (now - sentRegistrationHistory.get(sKey) < HISTORY_TIMEOUT_MS) return true;
        sentRegistrationHistory.delete(sKey);
    }
    if (eKey && sentRegistrationHistory.has(eKey)) {
        if (now - sentRegistrationHistory.get(eKey) < HISTORY_TIMEOUT_MS) return true;
        sentRegistrationHistory.delete(eKey);
    }

    return false;
}

function acquireRegistrationLock(studentId, email = null) {
    const now = Date.now();
    const cleanId = Number(studentId);
    const sKey = (cleanId && cleanId > 0) ? `std_${cleanId}` : null;
    const eKey = email ? `email_${String(email).trim().toLowerCase()}` : null;

    if (isRegistrationLocked(studentId, email)) {
        return false; // Already locked or sent recently
    }

    if (sKey) activeRegistrationLocks.set(sKey, now);
    if (eKey) activeRegistrationLocks.set(eKey, now);
    return true;
}

function releaseRegistrationLock(studentId, email = null, markCompleted = false) {
    const now = Date.now();
    const cleanId = Number(studentId);
    const sKey = (cleanId && cleanId > 0) ? `std_${cleanId}` : null;
    const eKey = email ? `email_${String(email).trim().toLowerCase()}` : null;

    if (sKey) {
        activeRegistrationLocks.delete(sKey);
        if (markCompleted) sentRegistrationHistory.set(sKey, now);
    }
    if (eKey) {
        activeRegistrationLocks.delete(eKey);
        if (markCompleted) sentRegistrationHistory.set(eKey, now);
    }
}

function formatTime12h(timeStr) {
    if (!timeStr) return '';
    const s = String(timeStr).trim();
    if (/AM|PM/i.test(s)) return s;
    const parts = s.split(':');
    if (parts.length >= 2) {
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(h) && !isNaN(m)) {
            const period = h < 12 ? 'AM' : 'PM';
            let h12 = h % 12;
            if (h12 === 0) h12 = 12;
            return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
        }
    }
    return s;
}

function calculateDurationString(startStr, endStr) {
    if (!startStr || !endStr) return '1 Hour 15 Minutes';
    const parseToMinutes = (t) => {
        const str = String(t).trim().toUpperCase();
        const isPm = str.includes('PM');
        const isAm = str.includes('AM');
        const clean = str.replace(/AM|PM/g, '').trim();
        const parts = clean.split(':');
        if (parts.length >= 2) {
            let h = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            if (!isNaN(h) && !isNaN(m)) {
                if (isPm && h < 12) h += 12;
                else if (isAm && h === 12) h = 0;
                return h * 60 + m;
            }
        }
        return null;
    };

    const sm = parseToMinutes(startStr);
    const em = parseToMinutes(endStr);
    if (sm !== null && em !== null) {
        let diff = em - sm;
        if (diff < 0) diff += 24 * 60;
        const hours = Math.floor(diff / 60);
        const mins = diff % 60;
        const parts = [];
        if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'Hour' : 'Hours'}`);
        if (mins > 0) parts.push(`${mins} ${mins === 1 ? 'Minute' : 'Minutes'}`);
        if (parts.length > 0) return parts.join(' ');
    }
    return '1 Hour 15 Minutes';
}

/**
 * Automatically dispatches Registration Confirmation and Assigned Staff emails.
 * EXACTLY TWO EMAILS ARE SENT PER REGISTRATION, BOTH DELIVERED TO THE STUDENT'S EMAIL:
 * 1. Exactly ONE Registration Email -> Student's registered email address (with PDF receipt attachment).
 * 2. Exactly ONE Assigned Staff Email -> Student's registered email address.
 */
async function sendRegistrationConfirmationEmails({ studentId, courseId = null, batchId = null, slotId = null, req = null }) {
    const cleanStudentId = Number(studentId);
    if (!cleanStudentId || cleanStudentId <= 0) {
        console.log('[REGISTRATION EMAIL] Skipped: Invalid Student_ID.');
        return { success: false, reason: 'Invalid Student_ID' };
    }

    // 0. Synchronous In-Memory Lock to instantly eliminate concurrent execution & race conditions
    if (!acquireRegistrationLock(cleanStudentId, null)) {
        console.log(`[REGISTRATION EMAIL] Duplicate prevented: Registration emails already processing or recently sent for Student ${cleanStudentId}. Skipping.`);
        return { success: true, skipped: true, duplicatePrevented: true, reason: 'In-memory lock active' };
    }

    try {
        // 1. Fetch student information from database
        const [studentRows] = await db.promise().query(
            `SELECT s.Student_ID, s.First_Name, s.Last_Name, s.Email, s.Phone_Number, s.Country_Code, s.Roll_No, s.Roll_No_Character, 
                    s.Branch_Id, s.Branch_Name, s.Admission_Date, s.Registered_On, s.To_User_Id, s.To_User_Name, s.Is_Registered,
                    b.Branch_Name as Db_Branch_Name
             FROM student s
             LEFT JOIN branches b ON s.Branch_Id = b.Branch_Id
             WHERE s.Student_ID = ? AND (s.Delete_Status = 0 OR s.Delete_Status IS NULL) 
             LIMIT 1`,
            [cleanStudentId]
        );

        if (!studentRows || studentRows.length === 0) {
            console.warn(`[REGISTRATION EMAIL] Student ID ${cleanStudentId} not found in database.`);
            releaseRegistrationLock(cleanStudentId, null, false);
            return { success: false, reason: 'Student not found' };
        }

        const student = studentRows[0];
        const studentEmail = (student.Email || '').trim();
        if (!studentEmail || !isValidEmail(studentEmail)) {
            console.log(`[REGISTRATION EMAIL] Skipped for Student ${cleanStudentId}: Missing or invalid email (${studentEmail}).`);
            releaseRegistrationLock(cleanStudentId, null, false);
            return { success: false, reason: 'Invalid email' };
        }

        // Secondary lock check by student email address
        if (isRegistrationLocked(null, studentEmail)) {
            console.log(`[REGISTRATION EMAIL] Duplicate prevented: Registration emails already sent recently to email ${studentEmail}. Skipping.`);
            releaseRegistrationLock(cleanStudentId, null, true);
            return { success: true, skipped: true, duplicatePrevented: true, reason: 'Email recently sent' };
        }
        acquireRegistrationLock(cleanStudentId, studentEmail);

        // 2. Persistent database log check (10 minutes window)
        try {
            const [recentLogs] = await db.promise().query(
                `SELECT Log_ID FROM email_logs 
                 WHERE (Student_ID = ? OR LOWER(TRIM(Email_Address)) = LOWER(TRIM(?)))
                   AND (Subject LIKE '%Enrolment Confirmation%' OR Subject LIKE '%Welcome mail with receipt%' OR Subject LIKE '%Student Registration%' OR Template_ID IN (19, 23))
                   AND Status = 'Success' 
                   AND Sent_At >= NOW() - INTERVAL 10 MINUTE 
                 LIMIT 1`,
                [cleanStudentId, studentEmail]
            );
            if (recentLogs && recentLogs.length > 0) {
                console.log(`[REGISTRATION EMAIL] Deduplication check: Registration email already logged recently in database for Student ${cleanStudentId} (${studentEmail}). Skipping.`);
                releaseRegistrationLock(cleanStudentId, studentEmail, true);
                return { success: true, skipped: true, duplicatePrevented: true, reason: 'Already logged recently' };
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
                let resolvedEnrollmentDate = null;
                const [scRows] = await db.promise().query(
                    `SELECT Course_ID, Batch_ID, Slot_Id, Enrollment_Date 
                     FROM student_course 
                     WHERE Student_ID = ? AND (Delete_Status = 0 OR Delete_Status IS NULL) 
                     ORDER BY StudentCourse_ID DESC LIMIT 1`,
                    [cleanStudentId]
                );
                if (scRows && scRows.length > 0) {
                    if (!resolvedCourseId) resolvedCourseId = Number(scRows[0].Course_ID) || 0;
                    if (!resolvedBatchId) resolvedBatchId = Number(scRows[0].Batch_ID) || 0;
                    if (!resolvedSlotId) resolvedSlotId = Number(scRows[0].Slot_Id) || 0;
                    if (scRows[0].Enrollment_Date) resolvedEnrollmentDate = scRows[0].Enrollment_Date;
                }
            } catch (scErr) {
                console.warn('[REGISTRATION EMAIL] Error looking up student_course:', scErr.message);
            }
        }

        // Fetch Course Name & Validity
        let courseName = 'PTE Academic Training';
        let courseValidity = null;
        if (resolvedCourseId > 0) {
            try {
                const [cRows] = await db.promise().query(
                    `SELECT Course_Name, Validity FROM course WHERE Course_ID = ? LIMIT 1`,
                    [resolvedCourseId]
                );
                if (cRows && cRows.length > 0 && cRows[0].Course_Name) {
                    courseName = cRows[0].Course_Name.trim();
                    courseValidity = cRows[0].Validity;
                }
            } catch (cErr) {}
        }

        // 3b. Dynamically fetch Course Starting Time and Ending Time from course details
        let rawStartTime = null;
        let rawEndTime = null;
        let commencingDateStr = null;

        const isDummyMidnight = (st, et) => {
            if (!st || !et) return true;
            const s = String(st).trim();
            const e = String(et).trim();
            return (s === '00:00:00' || s === '00:00') && (e === '00:00:00' || e === '00:00');
        };

        // Try slot first if assigned and not dummy 00:00
        if (resolvedSlotId > 0) {
            try {
                const [slotTiming] = await db.promise().query(
                    `SELECT start_time, end_time FROM teacher_time_slot WHERE Slot_Id = ? AND IFNULL(Delete_Status, 0) = 0 LIMIT 1`,
                    [resolvedSlotId]
                );
                if (slotTiming && slotTiming.length > 0 && slotTiming[0].start_time && slotTiming[0].end_time) {
                    if (!isDummyMidnight(slotTiming[0].start_time, slotTiming[0].end_time)) {
                        rawStartTime = slotTiming[0].start_time;
                        rawEndTime = slotTiming[0].end_time;
                    }
                }
            } catch (err) {}
        }

        // Try batch timing from course_batch
        if ((!rawStartTime || !rawEndTime) && resolvedBatchId > 0) {
            try {
                const [bRows] = await db.promise().query(
                    `SELECT Start_Time, End_Time, Commencing_Date FROM course_batch WHERE Batch_ID = ? LIMIT 1`,
                    [resolvedBatchId]
                );
                if (bRows && bRows.length > 0) {
                    if (bRows[0].Start_Time && bRows[0].End_Time && !isDummyMidnight(bRows[0].Start_Time, bRows[0].End_Time)) {
                        rawStartTime = bRows[0].Start_Time;
                        rawEndTime = bRows[0].End_Time;
                    }
                    if (bRows[0].Commencing_Date) {
                        commencingDateStr = new Date(bRows[0].Commencing_Date).toLocaleDateString('en-GB');
                    }
                }
            } catch (bErr) {}
        }

        // Try teacher_time_slot by batch_id
        if ((!rawStartTime || !rawEndTime) && resolvedBatchId > 0) {
            try {
                const [bSlotRows] = await db.promise().query(
                    `SELECT start_time, end_time FROM teacher_time_slot WHERE batch_id = ? AND IFNULL(Delete_Status, 0) = 0 LIMIT 1`,
                    [resolvedBatchId]
                );
                if (bSlotRows && bSlotRows.length > 0 && bSlotRows[0].start_time && bSlotRows[0].end_time) {
                    if (!isDummyMidnight(bSlotRows[0].start_time, bSlotRows[0].end_time)) {
                        rawStartTime = bSlotRows[0].start_time;
                        rawEndTime = bSlotRows[0].end_time;
                    }
                }
            } catch (err) {}
        }

        // Try course_teacher -> teacher_time_slot for the course
        if ((!rawStartTime || !rawEndTime) && resolvedCourseId > 0) {
            try {
                const [cSlotRows] = await db.promise().query(
                    `SELECT tts.start_time, tts.end_time 
                     FROM teacher_time_slot tts 
                     JOIN course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID 
                     WHERE ct.Course_ID = ? AND IFNULL(tts.Delete_Status, 0) = 0 
                     ORDER BY tts.Slot_Id ASC LIMIT 1`,
                    [resolvedCourseId]
                );
                if (cSlotRows && cSlotRows.length > 0 && cSlotRows[0].start_time && cSlotRows[0].end_time) {
                    if (!isDummyMidnight(cSlotRows[0].start_time, cSlotRows[0].end_time)) {
                        rawStartTime = cSlotRows[0].start_time;
                        rawEndTime = cSlotRows[0].end_time;
                    }
                }
            } catch (err) {}
        }

        // Try course_batch for the course
        if ((!rawStartTime || !rawEndTime) && resolvedCourseId > 0) {
            try {
                const [cbRows] = await db.promise().query(
                    `SELECT Start_Time, End_Time, Commencing_Date FROM course_batch WHERE Course_ID = ? AND IFNULL(Delete_Status, 0) = 0 ORDER BY Batch_ID DESC LIMIT 1`,
                    [resolvedCourseId]
                );
                if (cbRows && cbRows.length > 0) {
                    if (cbRows[0].Start_Time && cbRows[0].End_Time && !isDummyMidnight(cbRows[0].Start_Time, cbRows[0].End_Time)) {
                        rawStartTime = cbRows[0].Start_Time;
                        rawEndTime = cbRows[0].End_Time;
                    }
                    if (cbRows[0].Commencing_Date && !commencingDateStr) {
                        commencingDateStr = new Date(cbRows[0].Commencing_Date).toLocaleDateString('en-GB');
                    }
                }
            } catch (err) {}
        }

        // Format dynamic training time & duration
        const formattedStart = formatTime12h(rawStartTime) || '10:00 AM';
        const formattedEnd = formatTime12h(rawEndTime) || '11:15 AM';
        const dailyTrainingTimeStr = `${formattedStart} \u2013 ${formattedEnd}`;
        const sessionDurationStr = calculateDurationString(rawStartTime || '10:00:00', rawEndTime || '11:15:00');

        // 4. Resolve Assigned Trainer / Staff details with availability check
        let trainerName = student.To_User_Name || 'Assigned Trainer';
        let trainerEmail = '';
        let trainerPhone = '';

        try {
            let staffUser = null;
            // 4a. Check assigned slot if available
            if (resolvedSlotId > 0) {
                const [slotStaff] = await db.promise().query(
                    `SELECT u.User_ID, u.First_Name, u.Last_Name, u.Email, u.PhoneNumber,
                            TIME_FORMAT(tts.start_time, '%h:%i %p') AS start_time,
                            TIME_FORMAT(tts.end_time, '%h:%i %p') AS end_time 
                     FROM teacher_time_slot tts 
                     JOIN course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID 
                     JOIN users u ON ct.Teacher_ID = u.User_ID 
                     WHERE tts.Slot_Id = ? AND IFNULL(tts.Delete_Status, 0) = 0 LIMIT 1`,
                    [resolvedSlotId]
                );
                if (slotStaff && slotStaff.length > 0) {
                    staffUser = slotStaff[0];
                    if (staffUser.start_time && staffUser.end_time) {
                        batchTimeStr = `${staffUser.start_time} - ${staffUser.end_time}`;
                    }
                }
            }

            // 4b. If no slot was assigned, find an available (free) trainer for this course
            if (!staffUser && resolvedCourseId > 0) {
                try {
                    const [freeStaffRows] = await db.promise().query(
                        `SELECT u.User_ID, u.First_Name, u.Last_Name, u.Email, u.PhoneNumber,
                                TIME_FORMAT(tts.start_time, '%h:%i %p') AS start_time,
                                TIME_FORMAT(tts.end_time, '%h:%i %p') AS end_time,
                                tts.Slot_Id
                         FROM teacher_time_slot tts
                         JOIN course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID
                         JOIN users u ON u.User_ID = ct.Teacher_ID
                         LEFT JOIN student_course sc ON tts.Slot_Id = sc.Slot_Id 
                              AND sc.Course_ID = ct.Course_ID 
                              AND (sc.Delete_Status = 0 OR sc.Delete_Status IS NULL)
                         LEFT JOIN student s ON sc.Student_ID = s.Student_ID AND (s.Delete_Status = 0 OR s.Delete_Status IS NULL)
                         WHERE ct.Course_ID = ?
                           AND IFNULL(tts.Delete_Status, 0) = 0 
                           AND IFNULL(ct.Delete_Status, 0) = 0
                           AND IFNULL(u.Delete_Status, 0) = 0
                           AND tts.batch_id IS NULL 
                         GROUP BY tts.Slot_Id, tts.start_time, tts.end_time, ct.Course_ID, u.First_Name, u.Last_Name, u.User_ID
                         HAVING (COUNT(CASE WHEN s.Student_ID IS NOT NULL AND (sc.Expiry_Date IS NULL OR sc.Expiry_Date >= CURDATE()) THEN 1 END) = 0)
                         ORDER BY tts.Slot_Id ASC LIMIT 1`,
                        [resolvedCourseId]
                    );
                    if (freeStaffRows && freeStaffRows.length > 0) {
                        staffUser = freeStaffRows[0];
                        console.log(`[REGISTRATION EMAIL] Found available trainer for Course ${resolvedCourseId}:`, staffUser.First_Name, staffUser.Last_Name);
                    }
                } catch (freeErr) {
                    console.warn('[REGISTRATION EMAIL] Error finding available trainer:', freeErr.message);
                }
            }

            // 4c. Fallback to any teacher assigned to course
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
        let currencySymbol = '\u20B9';
        let feeDataForPdf = null;

        try {
            const [feeRows] = await db.promise().query(
                `SELECT Amount, Paid_Amount, Transaction_ID, Fee_Status, Currency, Payment_Mode, Payment_Date, Course_Name, Fine_Amount 
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
                else if (f.Currency === 'GBP') currencySymbol = '\u00A3';
                else if (f.Currency === 'EUR') currencySymbol = '\u20AC';
                else if (f.Currency === 'AED') currencySymbol = 'AED';
                feeDataForPdf = {
                    Paid_Amount: p,
                    Amount: p,
                    Transaction_ID: f.Transaction_ID || '-',
                    Payment_Mode: f.Payment_Mode || '-',
                    Payment_Date: f.Payment_Date || null,
                    Course_Name: f.Course_Name || courseName,
                    Fine_Amount: parseFloat(f.Fine_Amount || 0)
                };
            }
        } catch (feeErr) {}

        // 6. Contact Information & Dynamic Placeholders
        const contactInfo = await getOfficialContactInfo(student.Branch_Id);
        const officialEmail = contactInfo.email || 'cs.mgr@testprepinenglish.com';
        const contactNumber = contactInfo.phone || '+91 79944 43028';

        const todayFormatted = new Date().toLocaleDateString('en-GB');
        const startDateFormatted = commencingDateStr || (student.Admission_Date ? new Date(student.Admission_Date).toLocaleDateString('en-GB') : todayFormatted);
        const studentFullName = `${student.First_Name || ''} ${student.Last_Name || ''}`.trim() || 'Student';
        const firstName = student.First_Name ? student.First_Name.trim() : studentFullName.split(' ')[0];
        
        // 1. Student ID: Fetch student's Admission Number from DB
        const admissionNo = student.Roll_No_Character || student.Roll_No || String(cleanStudentId);

        // 5. Training Mode: Fetch student's training mode (Online/Classroom) from DB
        const rawBranchName = student.Db_Branch_Name || student.Branch_Name || '';
        let trainingMode = 'Online';
        if (/classroom|offline|in-person|campus/i.test(rawBranchName)) {
            trainingMode = 'Classroom';
        } else if (/online/i.test(rawBranchName)) {
            trainingMode = 'Online';
        } else if (rawBranchName) {
            trainingMode = rawBranchName;
        }

        // 6. Enrolment Date: Fetch actual Registration Date (Student Enrolled Date) from DB
        let enrolmentDateFormatted = todayFormatted;
        const rawEnrolDate = student.Registered_On || (typeof resolvedEnrollmentDate !== 'undefined' ? resolvedEnrollmentDate : null) || student.Admission_Date;
        if (rawEnrolDate) {
            const ed = new Date(rawEnrolDate);
            if (!isNaN(ed.getTime())) {
                enrolmentDateFormatted = `${String(ed.getDate()).padStart(2, '0')}/${String(ed.getMonth() + 1).padStart(2, '0')}/${ed.getFullYear()}`;
            }
        }

        const placeholders = {
            'Student Name': studentFullName,
            'Student_Name': studentFullName,
            'First Name': firstName,
            'First_Name': firstName,
            'Lead Name': studentFullName,
            'Student ID': admissionNo,
            'Student_ID': admissionNo,
            'CRM ID': admissionNo,
            'CRM_ID': admissionNo,
            'Admission Number': admissionNo,
            'Admission_Number': admissionNo,
            'Roll Number': admissionNo,
            'Roll_No': admissionNo,
            'Course Name': courseName,
            'Course_Name': courseName,
            'Programme': courseName,
            'Duration': sessionDurationStr,
            'Training Duration': sessionDurationStr,
            'Session Duration': sessionDurationStr,
            'Course Duration': sessionDurationStr,
            'Training Mode': trainingMode,
            'Training_Mode': trainingMode,
            'Online/Classroom': trainingMode,
            'Online / Classroom': trainingMode,
            'Date': enrolmentDateFormatted,
            'Enrolment Date': enrolmentDateFormatted,
            'Enrolment_Date': enrolmentDateFormatted,
            'Enrollment Date': enrolmentDateFormatted,
            'Enrollment_Date': enrolmentDateFormatted,
            'Registration Date': enrolmentDateFormatted,
            'Registration_Date': enrolmentDateFormatted,
            'Start Date': startDateFormatted,
            'Course Commencement': startDateFormatted,
            'First Class Date': startDateFormatted,
            'Daily Training Time': dailyTrainingTimeStr,
            'Start Time \u2013 End Time': dailyTrainingTimeStr,
            'Start Time - End Time': dailyTrainingTimeStr,
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
            // Direct regex fallback replacements to guarantee 100% dynamic field replacement
            res = res
                .replace(/\[Student[\s_]*Name\]/gi, studentFullName)
                .replace(/\[Lead[\s_]*Name\]/gi, studentFullName)
                .replace(/\[Student[\s_]*ID\]/gi, admissionNo)
                .replace(/\[CRM[\s_]*ID\]/gi, admissionNo)
                .replace(/\[Admission[\s_]*(?:Number|No)\]/gi, admissionNo)
                .replace(/\[Roll[\s_]*(?:Number|No)\]/gi, admissionNo)
                .replace(/\[Programme\]/gi, courseName)
                .replace(/\[Program\]/gi, courseName)
                .replace(/\[Course[\s_]*Name\]/gi, courseName)
                .replace(/Programme:\s*PTE Academic Training/gi, `Programme: ${courseName}`)
                .replace(/Programme:\tPTE Academic Training/gi, `Programme:\t${courseName}`)
                .replace(/\[Duration\]/gi, sessionDurationStr)
                .replace(/\[(?:Session|Training|Course)[\s_]*Duration\]/gi, sessionDurationStr)
                .replace(/\[Online\s*[\/\\]\s*Classroom\]/gi, trainingMode)
                .replace(/\[Training[\s_]*Mode\]/gi, trainingMode)
                .replace(/\[Date\]/gi, enrolmentDateFormatted)
                .replace(/\[Enrolment[\s_]*Date\]/gi, enrolmentDateFormatted)
                .replace(/\[Enrollment[\s_]*Date\]/gi, enrolmentDateFormatted)
                .replace(/\[Registration[\s_]*Date\]/gi, enrolmentDateFormatted)
                .replace(/\[Start[\s_]*Time[\s\u2013\-—]+End[\s_]*Time\]/gi, dailyTrainingTimeStr)
                .replace(/\[Daily[\s_]*Training[\s_]*Time\]/gi, dailyTrainingTimeStr);
            return res;
        };

        // =========================================================================
        // EMAIL 1: Registration Confirmation & Receipt (Sent to Student's Email)
        // =========================================================================
        let receiptTemplate = null;
        try {
            const [rRows] = await db.promise().query(
                `SELECT Template_ID, Subject, Body FROM email_templates 
                 WHERE (Template_ID = 19 OR Template_Name LIKE '%receipt%' OR Template_Name LIKE '%Welcome mail with receipt%' OR Template_Name LIKE '%Registration completed%') 
                   AND (Delete_Status = 0 OR Delete_Status IS NULL) 
                 ORDER BY (Template_ID = 19) DESC, (Is_Active = 1) DESC LIMIT 1`
            );
            if (rRows && rRows.length > 0) receiptTemplate = rRows[0];
        } catch (e) {}

        const receiptSubject = receiptTemplate ? replaceAllPlaceholders(receiptTemplate.Subject) : `Registration completed – ${courseName} | Aives Australia's TESTPREP`;
        const receiptRawBody = receiptTemplate?.Body || `Dear [First Name],

Welcome to Aives Australia's TESTPREP! We are delighted to confirm your enrolment in our [Course Name] programme.

Your Enrolment Details:
• Student Name: [Student Name]
• Student ID: [Student ID]
• Programme: [Course Name]
• Training Mode: [Training Mode]
• Course Commencement: [Start Date]
• Daily Training Time: [Daily Training Time] ([Time Zone])
• Payment Amount: [Payment Amount]
• Transaction Reference: [Transaction ID]

Please find your official Payment Receipt attached to this email for your records.

Our Student Support and Academic Team will guide you through every stage of your preparation. If you have any questions prior to class commencement, please reach out to us at [Official Email] or [Contact Number].

We wish you the very best in achieving your target score!

Warm regards,

Student Admissions & Administration Team
Aives Australia's TESTPREP
[Official Email] | [Contact Number]`;

        const receiptHtmlBody = replaceAllPlaceholders(receiptRawBody).replace(/\n/g, '<br>');
        // Generate a PDF receipt attachment if fee data is available
        let receiptAttachments = [];
        if (feeDataForPdf) {
            try {
                const pdfBase64 = await generateReceiptPDFBase64({
                    student: {
                        First_Name: student.First_Name,
                        Last_Name: student.Last_Name,
                        Phone_Number: student.Phone_Number
                    },
                    feeData: { ...feeDataForPdf, Course_Name: feeDataForPdf.Course_Name || courseName },
                    currencySymbol
                });
                if (pdfBase64) {
                    const safeName = (student.First_Name || 'Student').replace(/\s+/g, '_');
                    receiptAttachments.push({
                        name: `Payment_Receipt_${safeName}.pdf`,
                        content: pdfBase64
                    });
                    console.log(`[REGISTRATION EMAIL] ✅ Payment receipt PDF generated for Student ${cleanStudentId}`);
                }
            } catch (pdfErr) {
                console.warn('[REGISTRATION EMAIL] Warning: Could not generate receipt PDF:', pdfErr.message);
            }
        }

        console.log(`[REGISTRATION EMAIL] Sending Registration Email (1 of 2) to Student: ${studentEmail} (Admission No: ${admissionNo})...`);
        const sendReceiptRes = await emailHelper.sendEmail(
            studentEmail,
            receiptSubject,
            receiptHtmlBody,
            officialEmail,
            "Aives Australia's TESTPREP",
            receiptAttachments.length > 0 ? receiptAttachments : null
        );

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
        console.log(`[REGISTRATION EMAIL] ✅ Exactly ONE Registration email sent successfully to Student (${studentEmail})`);

        // =========================================================================
        // EMAIL 2: Assigned Staff Email (ALSO Sent to Student's Email Address)
        // =========================================================================
        let staffTemplate = null;
        try {
            const [sRows] = await db.promise().query(
                `SELECT Template_ID, Subject, Body FROM email_templates 
                 WHERE (Template_ID = 23 OR Template_Name LIKE '%Student Registration%' OR Template_Name LIKE '%assigned staff%' OR Template_Name LIKE '%assigned trainer%' OR Subject LIKE '%Student Registration%') 
                   AND (Delete_Status = 0 OR Delete_Status IS NULL) 
                 ORDER BY (Template_ID = 23) DESC, (Template_Name LIKE '%Student Registration%') DESC, (Is_Active = 1) DESC LIMIT 1`
            );
            if (sRows && sRows.length > 0) staffTemplate = sRows[0];
        } catch (e) {}

        const staffSubject = staffTemplate ? replaceAllPlaceholders(staffTemplate.Subject) : `Student Registration & Training Details – ${studentFullName}`;
        const staffRawBody = staffTemplate?.Body || `Dear [First Name],

Greetings from Aives Australia's TESTPREP!

I am delighted to introduce myself as your assigned PTE Academic Trainer.
I will be conducting your training sessions over the next 20 live sessions helping you understand the PTE Academic examination, develop effective techniques, and improve your performance through structured learning and regular practice.

Your Training Details
• Student Name: [Student Name]
• Student ID: [Student ID]
• Assigned Trainer: [Trainer Name]
• Course Commencement: [Course Commencement]
• Daily Training Time: [Daily Training Time]
• Time Zone: [Time Zone]
• Training Duration: [Training Duration]

Your Zoom Classroom Access
Class link will be shared to you prior to class, Use the same link everyday.

If you have any questions prior to class commencement, please feel free to reach out to us at [Official Email] or [Contact Number].

Warm regards,

Academic Coordination Team
Aives Australia's TESTPREP
[Official Email] | [Contact Number]`;

        const staffHtmlBody = replaceAllPlaceholders(staffRawBody).replace(/\n/g, '<br>');

        // The Assigned Staff Email is delivered directly to the REGISTERED STUDENT'S EMAIL
        console.log(`[REGISTRATION EMAIL] Sending Assigned Staff Email (2 of 2) to Student: ${studentEmail} (Trainer: ${trainerName})...`);
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
        console.log(`[REGISTRATION EMAIL] ✅ Exactly ONE Assigned Staff email sent successfully to Student (${studentEmail})`);

        // Mark completed in history
        releaseRegistrationLock(cleanStudentId, studentEmail, true);

        return { success: true };
    } catch (err) {
        console.error('[REGISTRATION EMAIL] Critical error during registration email process:', err);
        releaseRegistrationLock(cleanStudentId, null, false);
        return { success: false, error: err.message };
    }
}

module.exports = {
    sendRegistrationConfirmationEmails,
    formatTime12h,
    calculateDurationString,
    isRegistrationLocked,
    acquireRegistrationLock,
    releaseRegistrationLock
};
