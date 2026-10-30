const express = require('express');
const router = express.Router();
const db = require('../config/dbconnection');
const { verifyLeadToken } = require('../helpers/lead-welcome-helper');

/**
 * Helper to update student remark and followup in CRM when a response is received
 */
async function updateStudentCRMRecord(studentId, choice, comments = '') {
    if (!studentId || studentId <= 0) return;
    try {
        const responseSummary = `[LEAD RESPONSE: ${choice.toUpperCase()}]${comments ? ` Note: ${comments}` : ''}`;

        // 1. Update Remark in student table
        await db.promise().query(
            `UPDATE student 
             SET Remark = CASE 
                 WHEN Remark IS NULL OR TRIM(Remark) = '' THEN ? 
                 ELSE CONCAT(?, '\n', Remark) 
             END 
             WHERE Student_ID = ?`,
            [responseSummary, responseSummary, studentId]
        );

        // 2. Fetch latest followup info if exists to inherit branch/staff
        const [followups] = await db.promise().query(
            `SELECT Follow_Up_ID, Branch_ID, Branch_Name, Department_ID, Department_Name, Assigned_Staff_ID, Assigned_Staff_Name 
             FROM student_followup 
             WHERE Student_ID = ? AND (Delete_Status = 0 OR Delete_Status IS NULL) 
             ORDER BY Follow_Up_ID DESC LIMIT 1`,
            [studentId]
        );

        const latestFu = followups.length > 0 ? followups[0] : {};
        const statusName = choice === 'Interested' ? 'Interested' : 'Not Interested';

        await db.promise().query(
            `INSERT INTO student_followup 
             (Student_ID, Branch_ID, Branch_Name, Department_ID, Department_Name, Assigned_Staff_ID, Assigned_Staff_Name, Follow_Up_Status_ID, Follow_Up_Status_Name, Next_Follow_Up_Date, Remark, Created_Date, Created_By, Delete_Status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 11, ?, NULL, ?, NOW(), 0, 0)`,
            [
                studentId,
                latestFu.Branch_ID || 0,
                latestFu.Branch_Name || '',
                latestFu.Department_ID || 0,
                latestFu.Department_Name || '',
                latestFu.Assigned_Staff_ID || null,
                latestFu.Assigned_Staff_Name || '',
                statusName,
                `Lead submitted response: ${choice}${comments ? ` (${comments})` : ''}`
            ]
        );
    } catch (err) {
        console.warn('[LEAD RESPONSE] Warning updating CRM followup:', err.message);
    }
}

/**
 * Helper to save or update lead_response record
 */
async function saveLeadResponseRecord({ studentId, email, name, phone, choice, comments = '', rawPayload = {} }) {
    const rawResponseJson = JSON.stringify({
        recordedAt: new Date().toISOString(),
        choice,
        comments,
        payload: rawPayload
    });

    // Check if response already exists
    const [existing] = await db.promise().query(
        `SELECT Response_ID FROM lead_response 
         WHERE Student_ID = ? AND (Delete_Status = 0 OR Delete_Status IS NULL) 
         LIMIT 1`,
        [studentId]
    );

    if (existing.length > 0) {
        const responseId = existing[0].Response_ID;
        await db.promise().query(
            `UPDATE lead_response 
             SET Response_Choice = ?, Interested_Course = ?, Comments = ?, Raw_Response = ?, Submitted_At = NOW() 
             WHERE Response_ID = ?`,
            [choice, choice, comments || null, rawResponseJson, responseId]
        );
        return responseId;
    } else {
        const [result] = await db.promise().query(
            `INSERT INTO lead_response 
             (Student_ID, Email, Full_Name, Phone_Number, Response_Choice, Interested_Course, Comments, Raw_Response, Submitted_At) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [studentId, email, name, phone, choice, choice, comments || null, rawResponseJson]
        );
        return result.insertId;
    }
}

/**
 * GET /lead-response
 * Handles both 1-click email response links AND form rendering
 */
router.get('/', async (req, res) => {
    try {
        const studentId = parseInt(req.query.id || req.query.studentId || 0);
        const email = (req.query.email || '').trim();
        const token = (req.query.token || '').trim();
        const rawChoice = (req.query.choice || '').trim();

        // 1. Fetch Student Details if ID provided
        let student = null;
        let existingResponse = null;

        if (studentId > 0) {
            const [students] = await db.promise().query(
                `SELECT Student_ID, First_Name, Last_Name, Email, Phone_Number, Country_Code 
                 FROM student 
                 WHERE Student_ID = ? AND (Delete_Status = 0 OR Delete_Status IS NULL) 
                 LIMIT 1`,
                [studentId]
            );

            if (students.length > 0) {
                student = students[0];
            }

            const [responses] = await db.promise().query(
                `SELECT * FROM lead_response 
                 WHERE Student_ID = ? AND (Delete_Status = 0 OR Delete_Status IS NULL) 
                 ORDER BY Submitted_At DESC LIMIT 1`,
                [studentId]
            );
            if (responses.length > 0) {
                existingResponse = responses[0];
            }
        } else if (email) {
            // Find by email if ID not present
            const [students] = await db.promise().query(
                `SELECT Student_ID, First_Name, Last_Name, Email, Phone_Number, Country_Code 
                 FROM student 
                 WHERE LOWER(TRIM(Email)) = LOWER(TRIM(?)) AND (Delete_Status = 0 OR Delete_Status IS NULL) 
                 ORDER BY Student_ID DESC LIMIT 1`,
                [email]
            );
            if (students.length > 0) {
                student = students[0];
            }
        }

        const studentEmail = student?.Email || email;
        const studentName = student ? `${student.First_Name || ''} ${student.Last_Name || ''}`.trim() : '';
        const studentPhone = student ? `${student.Country_Code || '+91'} ${student.Phone_Number || ''}`.trim() : '';
        const effectiveStudentId = student?.Student_ID || studentId;

        // CASE A: 1-Click Action from Email (choice query param is present)
        if (rawChoice) {
            const isNotInterested = rawChoice.toLowerCase().includes('not');
            const choice = isNotInterested ? 'Not Interested' : 'Interested';

            // Record response immediately
            if (effectiveStudentId > 0 || studentEmail) {
                await saveLeadResponseRecord({
                    studentId: effectiveStudentId,
                    email: studentEmail,
                    name: studentName,
                    phone: studentPhone,
                    choice: choice,
                    comments: '',
                    rawPayload: { query: req.query, ip: req.ip, userAgent: req.headers['user-agent'] }
                });

                await updateStudentCRMRecord(effectiveStudentId, choice);
            }

            // Render mobile-first instant confirmation page
            return res.send(renderConfirmationHtml({
                name: studentName,
                choice: choice,
                studentId: effectiveStudentId,
                email: studentEmail,
                token: token
            }));
        }

        // CASE B: Render the single-question form ("Are you interested or not?")
        const currentChoice = existingResponse?.Response_Choice || existingResponse?.Interested_Course || '';
        const isCurrentInterested = currentChoice.toLowerCase().includes('interest') && !currentChoice.toLowerCase().includes('not');
        const isCurrentNotInterested = currentChoice.toLowerCase().includes('not');

        const formHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Response Form - Trackbox</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-tap-highlight-color: transparent; }
        body {
            background-color: #f1f5f9;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px 12px;
            color: #0f172a;
        }
        .container {
            max-width: 480px;
            width: 100%;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
            overflow: hidden;
            border: 1px solid #e2e8f0;
        }
        .header {
            background: linear-gradient(135deg, #003366 0%, #001f3f 100%);
            padding: 24px 20px;
            color: #ffffff;
            text-align: center;
        }
        .header h1 {
            font-size: 20px;
            font-weight: 800;
            margin-bottom: 6px;
        }
        .header p {
            color: #cbd5e1;
            font-size: 13px;
            line-height: 1.4;
        }
        .form-body {
            padding: 20px 18px;
        }
        .student-info {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 12px 14px;
            margin-bottom: 18px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
        }
        .info-label { color: #64748b; font-weight: 500; }
        .info-val { color: #0f172a; font-weight: 700; text-align: right; }
        .current-badge {
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            color: #065f46;
            border-radius: 8px;
            padding: 10px 12px;
            margin-bottom: 16px;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .question-title {
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 14px;
            line-height: 1.4;
        }
        .choice-group {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 18px;
        }
        .choice-card {
            display: flex;
            align-items: center;
            padding: 14px 16px;
            border: 2px solid #cbd5e1;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            background: #ffffff;
            user-select: none;
        }
        .choice-card:active {
            transform: scale(0.98);
        }
        .choice-card input[type="radio"] {
            margin-right: 12px;
            width: 20px;
            height: 20px;
            accent-color: #16a34a;
            cursor: pointer;
        }
        .choice-label {
            font-size: 15px;
            font-weight: 700;
            color: #1e293b;
            cursor: pointer;
            flex: 1;
        }
        .choice-desc {
            font-size: 12px;
            color: #64748b;
            display: block;
            margin-top: 2px;
            font-weight: 400;
        }
        .choice-card.selected-interested {
            border-color: #16a34a;
            background: #f0fdf4;
        }
        .choice-card.selected-interested .choice-label {
            color: #15803d;
        }
        .choice-card.selected-not {
            border-color: #64748b;
            background: #f8fafc;
        }
        .choice-card.selected-not .choice-label {
            color: #475569;
        }
        .comment-group {
            margin-bottom: 20px;
        }
        .comment-group label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: #334155;
            margin-bottom: 6px;
        }
        textarea {
            width: 100%;
            padding: 12px;
            border: 1.5px solid #cbd5e1;
            border-radius: 10px;
            font-size: 14px;
            color: #0f172a;
            outline: none;
            resize: vertical;
            transition: border-color 0.2s;
        }
        textarea:focus {
            border-color: #003366;
        }
        .btn-submit {
            background: linear-gradient(135deg, #003366 0%, #002244 100%);
            color: #ffffff;
            border: none;
            width: 100%;
            padding: 14px 20px;
            font-size: 16px;
            font-weight: 700;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 6px -1px rgba(0, 51, 102, 0.2);
        }
        .btn-submit:active {
            transform: scale(0.99);
        }
        .footer {
            padding: 16px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 12px;
            color: #64748b;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Trackbox Education</h1>
            <p>Welcome, ${studentName || 'Student'}! Let us know your interest below.</p>
        </div>

        <div class="form-body">
            ${existingResponse ? `
            <div class="current-badge">
                <span>✓</span>
                <div>
                    <strong>Status:</strong> You previously submitted: <b>${existingResponse.Response_Choice || existingResponse.Interested_Course || 'Responded'}</b>. You can update your choice below.
                </div>
            </div>
            ` : ''}

            <div class="student-info">
                <div class="info-row">
                    <span class="info-label">Name:</span>
                    <span class="info-val">${studentName || 'Valued Lead'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Email:</span>
                    <span class="info-val">${studentEmail || '-'}</span>
                </div>
                ${studentPhone ? `
                <div class="info-row">
                    <span class="info-label">Phone:</span>
                    <span class="info-val">${studentPhone}</span>
                </div>` : ''}
            </div>

            <form id="responseForm" action="/lead-response" method="POST">
                <input type="hidden" name="studentId" value="${effectiveStudentId}" />
                <input type="hidden" name="email" value="${studentEmail}" />
                <input type="hidden" name="name" value="${studentName}" />
                <input type="hidden" name="phone" value="${studentPhone}" />
                <input type="hidden" name="token" value="${token}" />

                <div class="question-title">
                    Are you interested in our coaching programs? <span style="color: #ef4444;">*</span>
                </div>

                <div class="choice-group">
                    <label class="choice-card ${isCurrentInterested ? 'selected-interested' : ''}" id="card-interested">
                        <input type="radio" name="choice" value="Interested" required ${isCurrentInterested ? 'checked' : ''} onchange="onChoiceChange('Interested')">
                        <div class="choice-label">
                            👍 Yes, I am Interested
                            <span class="choice-desc">I want to learn more about your courses, batches, and fees.</span>
                        </div>
                    </label>

                    <label class="choice-card ${isCurrentNotInterested ? 'selected-not' : ''}" id="card-not-interested">
                        <input type="radio" name="choice" value="Not Interested" required ${isCurrentNotInterested ? 'checked' : ''} onchange="onChoiceChange('Not Interested')">
                        <div class="choice-label">
                            👎 No, Not Interested
                            <span class="choice-desc">I do not wish to join at this time.</span>
                        </div>
                    </label>
                </div>

                <div class="comment-group">
                    <label for="comments">Any notes, questions, or preferred call time? (Optional)</label>
                    <textarea id="comments" name="comments" rows="3" placeholder="E.g., call me after 5 PM, interested in PTE online, etc...">${existingResponse?.Comments || ''}</textarea>
                </div>

                <button type="submit" class="btn-submit" id="submitBtn">
                    Submit Response
                </button>
            </form>
        </div>

        <div class="footer">
            &copy; ${new Date().getFullYear()} Trackbox Education. All rights reserved.
        </div>
    </div>

    <script>
        function onChoiceChange(val) {
            const cardInterested = document.getElementById('card-interested');
            const cardNotInterested = document.getElementById('card-not-interested');
            if (val === 'Interested') {
                cardInterested.classList.add('selected-interested');
                cardNotInterested.classList.remove('selected-not');
            } else {
                cardNotInterested.classList.add('selected-not');
                cardInterested.classList.remove('selected-interested');
            }
        }
    </script>
</body>
</html>
        `;

        res.send(formHtml);

    } catch (err) {
        console.error('[LEAD RESPONSE GET] Error:', err);
        res.status(500).send('<h3>Unable to load response form. Please try again later.</h3>');
    }
});

/**
 * Helper to render the Mobile-First Confirmation Page
 */
function renderConfirmationHtml({ name, choice, studentId, email, token }) {
    const isInterested = choice === 'Interested';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Response Received - Trackbox</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-tap-highlight-color: transparent; }
        body {
            background-color: #f1f5f9;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px 12px;
            color: #0f172a;
        }
        .card {
            max-width: 440px;
            width: 100%;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08);
            padding: 32px 20px;
            text-align: center;
            border: 1px solid #e2e8f0;
        }
        .icon-circle {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            margin-bottom: 16px;
            background: ${isInterested ? '#dcfce7' : '#f1f5f9'};
            color: ${isInterested ? '#16a34a' : '#64748b'};
        }
        h1 {
            font-size: 22px;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 10px;
        }
        .status-badge {
            display: inline-block;
            background: ${isInterested ? '#dcfce7' : '#f1f5f9'};
            color: ${isInterested ? '#15803d' : '#475569'};
            border: 1px solid ${isInterested ? '#86efac' : '#cbd5e1'};
            padding: 6px 16px;
            border-radius: 9999px;
            font-size: 14px;
            font-weight: 700;
            margin-bottom: 16px;
        }
        p {
            font-size: 14px;
            color: #475569;
            line-height: 1.5;
            margin-bottom: 20px;
        }
        .optional-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px;
            margin-top: 16px;
            text-align: left;
        }
        .optional-box label {
            display: block;
            font-size: 12px;
            font-weight: 700;
            color: #334155;
            margin-bottom: 6px;
        }
        .optional-box textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            font-size: 13px;
            outline: none;
        }
        .btn-note {
            background: #003366;
            color: #ffffff;
            border: none;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: 600;
            border-radius: 6px;
            margin-top: 8px;
            cursor: pointer;
            width: 100%;
        }
        .btn-change {
            display: inline-block;
            margin-top: 16px;
            font-size: 13px;
            color: #0284c7;
            text-decoration: underline;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon-circle">
            ${isInterested ? '✓' : 'ℹ'}
        </div>
        <h1>Thank You${name ? `, ${name}` : ''}!</h1>
        
        <div class="status-badge">
            Response: ${choice}
        </div>

        <p>
            ${isInterested 
                ? 'We are delighted to know you are interested! Our course counselor will get in touch with you shortly to share course schedules and guidance.' 
                : 'Your response has been noted. We appreciate your time and will not disturb you with further promotional messages.'}
        </p>

        <!-- Optional Comments form if they want to add extra notes -->
        <div class="optional-box">
            <form action="/lead-response" method="POST">
                <input type="hidden" name="studentId" value="${studentId || 0}" />
                <input type="hidden" name="email" value="${email || ''}" />
                <input type="hidden" name="name" value="${name || ''}" />
                <input type="hidden" name="choice" value="${choice}" />
                <input type="hidden" name="token" value="${token || ''}" />

                <label for="extraComments">Want to add any note or preferred contact time?</label>
                <textarea id="extraComments" name="comments" rows="2" placeholder="Optional notes..."></textarea>
                <button type="submit" class="btn-note">Save Note</button>
            </form>
        </div>

        <div>
            <a href="/lead-response?id=${studentId}&email=${encodeURIComponent(email || '')}&token=${token}" class="btn-change">
                Change response or update answers
            </a>
        </div>
    </div>
</body>
</html>
    `;
}

/**
 * POST /lead-response
 * Saves the response submitted by the lead
 */
router.post('/', async (req, res) => {
    try {
        const studentId = parseInt(req.body.studentId || req.body.Student_ID || 0);
        const email = (req.body.email || req.body.Email || '').trim();
        const name = (req.body.name || req.body.Full_Name || '').trim();
        const phone = (req.body.phone || req.body.Phone_Number || '').trim();
        const token = (req.body.token || '').trim();
        const comments = (req.body.comments || req.body.Comments || '').trim();

        // Choice: can be 'choice' or 'interestedCourse'
        const rawChoice = (req.body.choice || req.body.interestedCourse || req.body.Response_Choice || '').trim();
        const isNotInterested = rawChoice.toLowerCase().includes('not');
        const choice = isNotInterested ? 'Not Interested' : 'Interested';

        console.log('[LEAD RESPONSE POST] Received:', { studentId, email, choice, comments });

        let resolvedStudentId = studentId;

        // If studentId missing, find student by email
        if (resolvedStudentId <= 0 && email) {
            const [matchedStudents] = await db.promise().query(
                `SELECT Student_ID, First_Name, Last_Name, Phone_Number FROM student 
                 WHERE LOWER(TRIM(Email)) = LOWER(TRIM(?)) AND (Delete_Status = 0 OR Delete_Status IS NULL) 
                 ORDER BY Student_ID DESC LIMIT 1`,
                [email]
            );
            if (matchedStudents.length > 0) {
                resolvedStudentId = matchedStudents[0].Student_ID;
            }
        }

        if (resolvedStudentId <= 0 && !email) {
            return res.status(400).send('<h3>Unable to associate response: Missing Student ID and Email.</h3>');
        }

        // Save into lead_response
        const responseId = await saveLeadResponseRecord({
            studentId: resolvedStudentId,
            email: email,
            name: name,
            phone: phone,
            choice: choice,
            comments: comments,
            rawPayload: { body: req.body, headers: req.headers }
        });

        // Update CRM
        await updateStudentCRMRecord(resolvedStudentId, choice, comments);

        console.log(`[LEAD RESPONSE POST] ✅ Response saved (ID ${responseId}) for Student ${resolvedStudentId}: ${choice}`);

        // Return JSON if XHR/JSON request
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.json({
                success: true,
                message: 'Your response has been recorded successfully.',
                responseId: responseId,
                choice: choice
            });
        }

        // Return mobile confirmation page
        res.send(renderConfirmationHtml({
            name: name,
            choice: choice,
            studentId: resolvedStudentId,
            email: email,
            token: token
        }));

    } catch (err) {
        console.error('[LEAD RESPONSE POST] Error saving response:', err);
        res.status(500).send('<h3>An error occurred while saving your response. Please try again.</h3>');
    }
});

/**
 * GET /lead-response/details/:studentId
 * Returns the response record for a given student ID
 */
router.get('/details/:studentId', async (req, res) => {
    try {
        const studentId = parseInt(req.params.studentId || 0);
        if (!studentId) {
            return res.status(400).json({ success: false, message: 'Invalid Student ID' });
        }

        const [rows] = await db.promise().query(
            `SELECT * FROM lead_response 
             WHERE Student_ID = ? AND (Delete_Status = 0 OR Delete_Status IS NULL) 
             ORDER BY Submitted_At DESC LIMIT 1`,
            [studentId]
        );

        if (rows.length === 0) {
            return res.json({ success: true, hasResponded: false, data: null });
        }

        res.json({ success: true, hasResponded: true, data: rows[0] });
    } catch (e) {
        console.error('Error fetching lead response details:', e);
        res.status(500).json({ success: false, message: 'Failed to fetch response details', error: e.message });
    }
});

module.exports = router;
