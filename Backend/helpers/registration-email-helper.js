const db = require('../config/dbconnection');
const emailHelper = require('./email-helper');
const emailLog = require('../models/email_log');
const { getOfficialContactInfo, isValidEmail } = require('./lead-welcome-helper');
const PDFDocument = require('pdfkit');

function formatCurrencySymbol(curr) {
    if (!curr) return 'A$';
    const c = String(curr).trim().toUpperCase();
    if (c === 'AUD') return 'A$';
    if (c === 'USD') return '$';
    if (c === 'GBP') return '£';
    if (c === 'EUR' || c === 'EURO') return 'EUR';
    if (c === 'AED') return 'AED';
    if (c === 'INR' || c === 'RS' || c === 'RS.' || c === '₹' || c === '\u20B9') return 'Rs.';
    return c;
}

/**
 * Generates a payment receipt PDF as a base64 string using pdfkit.
 * Mirrors the layout produced by the frontend generateReceiptPDFBase64 method.
 */
function generateReceiptPDFBase64({ student, feeData, currencySymbol }) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 42.5 });
            const buffers = [];
            doc.on('data', chunk => buffers.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer.toString('base64'));
            });
            doc.on('error', reject);

            const pageWidth = doc.page.width;
            const margin = 42.5;

            // ── Header ──────────────────────────────────────────────────
            doc.font('Helvetica-Bold').fontSize(18).fillColor('#000000')
               .text('AIVES Australia Testprep', margin, 45);

            doc.font('Helvetica').fontSize(9).fillColor('#000000')
               .text(
                   'Address: 2nd Floor, Geo Centre, Door No. 45, 1920 B3, NH-66, Chakkaraparambu, Vennala, Ernakulam, Kerala 682032',
                   margin, 70, { width: pageWidth - margin * 2 }
               );

            doc.moveTo(margin, 96).lineTo(pageWidth - margin, 96).lineWidth(0.5).strokeColor('#000000').stroke();

            // ── Title ───────────────────────────────────────────────────
            doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000')
               .text('PAYMENT RECEIPT', margin, 118, { align: 'center', width: pageWidth - margin * 2 });

            // ── Student / Payment Details (3 Rows, 2 Columns) ───────────
            const studentName = `${student.First_Name || ''} ${student.Last_Name || ''}`.trim() || 'Student';
            const phone = student.Phone_Number || student.MobileNo || '-';
            const course = feeData.Course_Name || student.Course_Name || '-';
            const rollNo = student.Roll_No || student.Roll_No_Character || student.RollNumber || student.Student_ID || '-';
            const paymentDate = feeData.Payment_Date
                ? new Date(feeData.Payment_Date).toLocaleDateString('en-GB')
                : new Date().toLocaleDateString('en-GB');

            const col1 = margin;
            const col2 = margin + 110;
            const col3 = margin + 260;
            const col4 = margin + 370;

            const row1Y = 145;
            const row2Y = 165;
            const row3Y = 185;

            doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Student Name:', col1, row1Y);
            doc.font('Helvetica').fontSize(10).fillColor('#000000').text(studentName, col2, row1Y);
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Payment Date:', col3, row1Y);
            doc.font('Helvetica').fontSize(10).fillColor('#000000').text(paymentDate, col4, row1Y);

            doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Phone Number:', col1, row2Y);
            doc.font('Helvetica').fontSize(10).fillColor('#000000').text(phone, col2, row2Y);
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Course:', col3, row2Y);
            doc.font('Helvetica').fontSize(10).fillColor('#000000').text(course, col4, row2Y, { width: pageWidth - margin - col4 });

            doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Roll No:', col1, row3Y);
            doc.font('Helvetica').fontSize(10).fillColor('#000000').text(String(rollNo), col2, row3Y);

            // ── Payment Breakdown Table ──────────────────────────────────
            const tableY = 215;
            const tableWidth = pageWidth - margin * 2;
            const colWidth = tableWidth / 2;
            const headerHeight = 22;
            const rowHeight = 22;

            // Header background (#337ab7)
            doc.rect(margin, tableY, tableWidth, headerHeight).fill('#337ab7');
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff')
               .text('Description', margin + 8, tableY + 6, { width: colWidth - 16 });
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff')
               .text('Amount', margin + colWidth + 8, tableY + 6, { width: colWidth - 16 });

            let pAmount = Number(feeData.Paid_Amount || 0);
            if (pAmount === 0) {
                pAmount = Number(feeData.Amount || feeData.Total_Amount || feeData.Total_FeeAmount || feeData.Fee_Amount || 0);
            }
            const paidAmount = pAmount;
            const fineAmount = Number(feeData.Fine_Amount || 0);
            const totalAmount = paidAmount + fineAmount;
            const symbol = formatCurrencySymbol(currencySymbol || feeData.Currency || 'A$');

            const rows = [['Fee Amount', `${symbol} ${paidAmount.toFixed(2)}`]];
            if (fineAmount > 0) rows.push(['Late Fine Applied', `${symbol} ${fineAmount.toFixed(2)}`]);
            rows.push(['Total Amount Paid', `${symbol} ${totalAmount.toFixed(2)}`]);

            let curY = tableY + headerHeight;
            rows.forEach((row, idx) => {
                const isTotalRow = idx === rows.length - 1;
                const bg = idx % 2 === 0 ? '#f5f5f5' : '#ffffff';
                doc.rect(margin, curY, tableWidth, rowHeight).fillAndStroke(bg, '#dddddd');
                const font = isTotalRow ? 'Helvetica-Bold' : 'Helvetica';
                doc.font(font).fontSize(10).fillColor('#000000')
                   .text(row[0], margin + 8, curY + 6, { width: colWidth - 16 });
                doc.font(font).fontSize(10).fillColor('#000000')
                   .text(row[1], margin + colWidth + 8, curY + 6, { width: colWidth - 16 });
                curY += rowHeight;
            });

            // ── Terms & Conditions ───────────────────────────────────────
            const termsY = curY + 25;
            doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000').text('Terms and Conditions:', margin, termsY);
            doc.font('Helvetica').fontSize(8).fillColor('#000000')
               .text('1. This receipt is subject to realisation of cheque.', margin, termsY + 15)
               .text('2. This receipt should be carefully preserved and produced on demand.', margin, termsY + 27)
               .text('3. Fees once paid are non-refundable/non-transferable under any circumstances.', margin, termsY + 39);

            // ── Footer Statement ─────────────────────────────────────────
            const footerY = termsY + 75;
            doc.font('Helvetica').fontSize(9).fillColor('#000000')
               .text(
                   'This is a computer-generated payment receipt and does not require a signature.',
                   margin, footerY,
                   { align: 'center', width: tableWidth }
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

function formatCourseDuration({ validity, startDate, endDate, customDuration } = {}) {
    if (customDuration && typeof customDuration === 'string' && customDuration.trim() && !/hour|minute/i.test(customDuration)) {
        return customDuration.trim();
    }
    // 1. From Course Validity
    if (validity !== null && validity !== undefined && !isNaN(Number(validity)) && Number(validity) > 0) {
        const v = Number(validity);
        if (v >= 28) {
            const months = Math.round(v / 30);
            return `${months} ${months === 1 ? 'Month' : 'Months'}`;
        }
        if (v === 1) return '1 Month';
        if (v > 1 && v <= 12) return `${v} Months`;
        return `${v} Days`;
    }
    // 2. From Batch or Enrollment Start_Date & End_Date
    if (startDate && endDate) {
        const s = new Date(startDate);
        const e = new Date(endDate);
        if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e > s) {
            const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays >= 28) {
                const months = Math.round(diffDays / 30);
                return `${months} ${months === 1 ? 'Month' : 'Months'}`;
            }
            if (diffDays >= 7) {
                const weeks = Math.round(diffDays / 7);
                return `${weeks} ${weeks === 1 ? 'Week' : 'Weeks'}`;
            }
            if (diffDays > 0) {
                return `${diffDays} ${diffDays === 1 ? 'Day' : 'Days'}`;
            }
        }
    }
    return '1 Month';
}

/**
 * Automatically dispatches Registration Confirmation and Assigned Staff emails.
 * EXACTLY TWO EMAILS ARE SENT PER REGISTRATION, BOTH DELIVERED TO THE STUDENT'S EMAIL:
 * 1. Exactly ONE Registration Email -> Student's registered email address (with PDF receipt attachment).
 * 2. Exactly ONE Assigned Staff Email -> Student's registered email address.
 */
async function sendRegistrationConfirmationEmails({ studentId, courseId = null, batchId = null, slotId = null, currency = null, req = null }) {
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
        let resolvedEnrollmentDate = null;
        let resolvedExpiryDate = null;

        if (!resolvedCourseId || !resolvedBatchId || !resolvedEnrollmentDate) {
            try {
                const [scRows] = await db.promise().query(
                    `SELECT Course_ID, Batch_ID, Slot_Id, Enrollment_Date, Expiry_Date 
                     FROM student_course 
                     WHERE Student_ID = ? AND (Delete_Status = 0 OR Delete_Status IS NULL) 
                     ORDER BY StudentCourse_ID DESC LIMIT 1`,
                    [cleanStudentId]
                );
                if (scRows && scRows.length > 0) {
                    if (!resolvedCourseId) resolvedCourseId = Number(scRows[0].Course_ID) || 0;
                    if (!resolvedBatchId) resolvedBatchId = Number(scRows[0].Batch_ID) || 0;
                    if (!resolvedSlotId) resolvedSlotId = Number(scRows[0].Slot_Id) || 0;
                    if (!resolvedEnrollmentDate && scRows[0].Enrollment_Date) resolvedEnrollmentDate = scRows[0].Enrollment_Date;
                    if (!resolvedExpiryDate && scRows[0].Expiry_Date) resolvedExpiryDate = scRows[0].Expiry_Date;
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

        let batchStartDate = null;
        let batchEndDate = null;

        // Try batch timing and dates from course_batch
        if (resolvedBatchId > 0) {
            try {
                const [bRows] = await db.promise().query(
                    `SELECT Start_Date, End_Date FROM course_batch WHERE Batch_ID = ? LIMIT 1`,
                    [resolvedBatchId]
                );
                if (bRows && bRows.length > 0) {
                    batchStartDate = bRows[0].Start_Date;
                    batchEndDate = bRows[0].End_Date;
                    if (bRows[0].Start_Date && !commencingDateStr) {
                        commencingDateStr = new Date(bRows[0].Start_Date).toLocaleDateString('en-GB');
                    }
                }
            } catch (bErr) {
                console.warn('[REGISTRATION EMAIL] Error querying course_batch for batchId:', bErr.message);
            }
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
        if (resolvedCourseId > 0 && (!batchStartDate || !batchEndDate)) {
            try {
                const [cbRows] = await db.promise().query(
                    `SELECT Start_Date, End_Date FROM course_batch WHERE Course_ID = ? AND IFNULL(Delete_Status, 0) = 0 ORDER BY Batch_ID DESC LIMIT 1`,
                    [resolvedCourseId]
                );
                if (cbRows && cbRows.length > 0) {
                    if (!batchStartDate && cbRows[0].Start_Date) batchStartDate = cbRows[0].Start_Date;
                    if (!batchEndDate && cbRows[0].End_Date) batchEndDate = cbRows[0].End_Date;
                    if (cbRows[0].Start_Date && !commencingDateStr) {
                        commencingDateStr = new Date(cbRows[0].Start_Date).toLocaleDateString('en-GB');
                    }
                }
            } catch (err) {
                console.warn('[REGISTRATION EMAIL] Error querying course_batch for courseId:', err.message);
            }
        }

        // Format dynamic training time & durations
        const formattedStart = formatTime12h(rawStartTime) || '10:00 AM';
        const formattedEnd = formatTime12h(rawEndTime) || '11:15 AM';
        const dailyTrainingTimeStr = `${formattedStart} \u2013 ${formattedEnd}`;
        const sessionDurationStr = calculateDurationString(rawStartTime || '10:00:00', rawEndTime || '11:15:00');
        const courseDurationStr = formatCourseDuration({
            validity: courseValidity,
            startDate: batchStartDate || resolvedEnrollmentDate,
            endDate: batchEndDate || resolvedExpiryDate,
            customDuration: req?.body?.Course_Duration || student?.Course_Duration
        });

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
        const rawCurrency = currency || req?.body?.Currency || req?.body?.currency || (req?.body?.feesForm && req?.body?.feesForm.Currency) || null;
        let currencySymbol = formatCurrencySymbol(rawCurrency);
        let paidAmount = '0.00';
        let transactionId = '-';
        let feeDataForPdf = null;

        try {
            // 5a. Check receipts table first (stores completed payment transactions)
            const [receiptRows] = await db.promise().query(
                `SELECT r.Receipt_Id, r.Amount, r.Payment_mode, r.Transaction_ID, r.Payment_Date, r.Fine_Amount 
                 FROM receipts r 
                 WHERE r.Student_Id = ? AND IFNULL(r.DeleteStatus, 0) = 0 
                 ORDER BY r.Receipt_Id DESC LIMIT 1`,
                [cleanStudentId]
            );

            // 5b. Check student_fees_details table (stores fee structure, installments, and payment status)
            const [feeRows] = await db.promise().query(
                `SELECT sfd.Student_Fees_ID, sfd.Total_Amount, sfd.Paid_Amount, sfd.Remaining_Amount, 
                        sfd.Transaction_ID, sfd.Fee_Status, sfd.Payment_Mode, sfd.Payment_Date, sfd.Course_Name 
                 FROM student_fees_details sfd 
                 WHERE sfd.Student_ID = ? AND IFNULL(sfd.Delete_Status, 0) = 0 
                 ORDER BY sfd.Student_Fees_ID DESC LIMIT 1`,
                [cleanStudentId]
            );

            // 5c. Check student_course table (stores course registration fee amounts)
            const [scRows] = await db.promise().query(
                `SELECT sc.Total_FeeAmount, sc.Fee_Amount, sc.Price 
                 FROM student_course sc 
                 WHERE sc.Student_ID = ? AND IFNULL(sc.Delete_Status, 0) = 0 
                 ORDER BY sc.StudentCourse_ID DESC LIMIT 1`,
                [cleanStudentId]
            );

            if (receiptRows && receiptRows.length > 0 && parseFloat(receiptRows[0].Amount || 0) > 0) {
                const r = receiptRows[0];
                const p = parseFloat(r.Amount || 0);
                paidAmount = p.toFixed(2);
                transactionId = r.Transaction_ID || '-';
                feeDataForPdf = {
                    Paid_Amount: p,
                    Amount: p,
                    Total_Amount: p,
                    Transaction_ID: r.Transaction_ID || '-',
                    Payment_Mode: r.Payment_mode || 'Online',
                    Payment_Date: r.Payment_Date || new Date(),
                    Course_Name: courseName,
                    Fine_Amount: parseFloat(r.Fine_Amount || 0),
                    Currency: currencySymbol
                };
            } else if (feeRows && feeRows.length > 0) {
                const f = feeRows[0];
                let p = parseFloat(f.Paid_Amount || 0);
                if (p === 0 && parseFloat(f.Total_Amount || 0) > 0) {
                    p = parseFloat(f.Total_Amount);
                } else if (p === 0 && parseFloat(f.Remaining_Amount || 0) > 0) {
                    p = parseFloat(f.Remaining_Amount);
                }
                if (p === 0 && scRows && scRows.length > 0) {
                    p = parseFloat(scRows[0].Total_FeeAmount || scRows[0].Fee_Amount || scRows[0].Price || 0);
                }
                paidAmount = p.toFixed(2);
                transactionId = f.Transaction_ID || '-';
                feeDataForPdf = {
                    Paid_Amount: p,
                    Amount: p,
                    Total_Amount: p,
                    Transaction_ID: f.Transaction_ID || '-',
                    Payment_Mode: f.Payment_Mode || 'Online',
                    Payment_Date: f.Payment_Date || new Date(),
                    Course_Name: f.Course_Name || courseName,
                    Fine_Amount: 0,
                    Currency: currencySymbol
                };
            } else if (scRows && scRows.length > 0 && parseFloat(scRows[0].Total_FeeAmount || scRows[0].Fee_Amount || scRows[0].Price || 0) > 0) {
                const sc = scRows[0];
                const p = parseFloat(sc.Total_FeeAmount || sc.Fee_Amount || sc.Price || 0);
                paidAmount = p.toFixed(2);
                feeDataForPdf = {
                    Paid_Amount: p,
                    Amount: p,
                    Total_Amount: p,
                    Transaction_ID: '-',
                    Payment_Mode: 'Online',
                    Payment_Date: new Date(),
                    Course_Name: courseName,
                    Fine_Amount: 0,
                    Currency: currencySymbol
                };
            } else {
                let p = parseFloat(req?.body?.Total_FeeAmount || req?.body?.Fee_Amount || req?.body?.Amount || req?.body?.Total_Amount || 0);
                paidAmount = p.toFixed(2);
                feeDataForPdf = {
                    Paid_Amount: p,
                    Amount: p,
                    Total_Amount: p,
                    Transaction_ID: '-',
                    Payment_Mode: 'Online',
                    Payment_Date: new Date(),
                    Course_Name: courseName,
                    Fine_Amount: 0,
                    Currency: currencySymbol
                };
            }
        } catch (feeErr) {
            console.warn('[REGISTRATION EMAIL] Error looking up fee details:', feeErr.message);
            let p = parseFloat(req?.body?.Total_FeeAmount || req?.body?.Fee_Amount || req?.body?.Amount || 0);
            paidAmount = p.toFixed(2);
            feeDataForPdf = {
                Paid_Amount: p,
                Amount: p,
                Total_Amount: p,
                Transaction_ID: '-',
                Payment_Mode: 'Online',
                Payment_Date: new Date(),
                Course_Name: courseName,
                Fine_Amount: 0,
                Currency: currencySymbol
            };
        }

        // 6. Contact Information & Dynamic Placeholders
        const contactInfo = await getOfficialContactInfo(student.Branch_Id);
        const officialEmail = contactInfo.email || 'cs.mgr@testprepinenglish.com';
        const contactNumber = contactInfo.phone || '+91 79944 43028';

        const todayFormatted = new Date().toLocaleDateString('en-GB');
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

        // 6. Enrolment Date: MUST be student.Admission_Date (as requested by user)
        let enrolmentDateFormatted = todayFormatted;
        const rawEnrolDate = student.Admission_Date || student.Registered_On || (typeof resolvedEnrollmentDate !== 'undefined' ? resolvedEnrollmentDate : null);
        if (rawEnrolDate) {
            const ed = new Date(rawEnrolDate);
            if (!isNaN(ed.getTime())) {
                enrolmentDateFormatted = `${String(ed.getDate()).padStart(2, '0')}/${String(ed.getMonth() + 1).padStart(2, '0')}/${ed.getFullYear()}`;
            }
        }

        // 7. Course Commencement / Start Date: MUST be Course / Batch Start Date (as requested by user)
        let courseStartDateRaw = batchStartDate || (typeof resolvedEnrollmentDate !== 'undefined' ? resolvedEnrollmentDate : null);
        let courseCommencementFormatted = '';
        if (courseStartDateRaw) {
            const cd = new Date(courseStartDateRaw);
            if (!isNaN(cd.getTime())) {
                courseCommencementFormatted = `${String(cd.getDate()).padStart(2, '0')}/${String(cd.getMonth() + 1).padStart(2, '0')}/${cd.getFullYear()}`;
            }
        }
        if (!courseCommencementFormatted) {
            courseCommencementFormatted = commencingDateStr || enrolmentDateFormatted;
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
            'Duration': courseDurationStr,
            'Course Duration': courseDurationStr,
            'Course_Duration': courseDurationStr,
            'Training Duration': courseDurationStr,
            'Session Duration': sessionDurationStr,
            'Class Duration': sessionDurationStr,
            'Daily Class Duration': sessionDurationStr,
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
            'Start Date': courseCommencementFormatted,
            'Course Commencement': courseCommencementFormatted,
            'First Class Date': courseCommencementFormatted,
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
                .replace(/\[Duration\]/gi, courseDurationStr)
                .replace(/\[(?:Course|Training)[\s_]*Duration\]/gi, courseDurationStr)
                .replace(/\[(?:Session|Class)[\s_]*Duration\]/gi, sessionDurationStr)
                .replace(/(•\s*Duration:\s*)1 Hour 15 Minutes/gi, `$1${courseDurationStr}`)
                .replace(/(Duration:\s*)1 Hour 15 Minutes/gi, `$1${courseDurationStr}`)
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
                        Phone_Number: student.Phone_Number || student.MobileNo,
                        Roll_No: admissionNo
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
            "TestPerp Aives",
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
        const sendStaffRes = await emailHelper.sendEmail(studentEmail, staffSubject, staffHtmlBody, officialEmail, "TestPerp Aives");

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
    formatCourseDuration,
    isRegistrationLocked,
    acquireRegistrationLock,
    releaseRegistrationLock
};
