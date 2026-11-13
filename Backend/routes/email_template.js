const express = require('express');
const router = express.Router();
const email_template = require('../models/email_template');

router.post('/Save_Email_Template', async (req, res) => {
    try {
        const rows = await email_template.Save_Email_Template(req.body);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to save email template', error: e.message });
    }
});

router.get('/Search_Email_Template', async (req, res) => {
    try {
        const rows = await email_template.Search_Email_Template(req.query.searchTerm);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to search email templates', error: e.message });
    }
});

router.get('/Get_Email_Template/:id', async (req, res) => {
    try {
        const rows = await email_template.Get_Email_Template(req.params.id);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get email template', error: e.message });
    }
});

router.get('/Delete_Email_Template/:id', async (req, res) => {
    try {
        const rows = await email_template.Delete_Email_Template(req.params.id);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to delete email template', error: e.message });
    }
});

const axios = require('axios');
const emailHelper = require('../helpers/email-helper');

router.get('/Test_Brevo_Connection', async (req, res) => {
    try {
        const config = emailHelper.getBrevoConfig();
        const toEmail = (req.query.to || '').trim();

        let accountData = null;
        let accountError = null;
        try {
            const accRes = await axios({
                method: 'get',
                url: 'https://api.brevo.com/v3/account',
                headers: {
                    'accept': 'application/json',
                    'api-key': config.apiKey
                },
                timeout: 10000
            });
            accountData = accRes.data;
        } catch (accErr) {
            accountError = accErr.response?.data || accErr.message;
        }

        let sendResult = null;
        let sendError = null;
        if (toEmail) {
            try {
                sendResult = await emailHelper.sendEmail(
                    toEmail,
                    'Brevo Live Connection Test',
                    '<p>Test email sent successfully from Aives CRM server.</p>'
                );
            } catch (sErr) {
                sendError = sErr.responseData || sErr.message;
            }
        }

        res.json({
            status: !accountError ? 'CONNECTED' : 'FAILED',
            apiKeyConfigured: !!config.apiKey,
            apiKeyConfigured: !!config.apiKey,
            accountType: config.accountType,
            senderEmail: config.senderEmail,
            senderName: config.senderName,
            brevoAccount: accountData,
            brevoAccountError: accountError,
            testEmailTo: toEmail || 'Pass ?to=your_email@domain.com in URL to test delivery',
            sendResult,
            sendError
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
const emailLog = require('../models/email_log');
const db = require('../config/dbconnection');
const { buildLeadResponseBlock, getOfficialContactInfo } = require('../helpers/lead-welcome-helper');
const { isRegistrationLocked, formatCourseDuration, calculateDurationString, formatTime12h } = require('../helpers/registration-email-helper');

const templateSendLocks = new Map();

router.post('/Send_Email_With_Template', async (req, res) => {
    try {
        const { Template_ID, To_Email, Placeholders, Sender_Email, Sender_Name, Attachments, Student_ID } = req.body;
        const effectiveSenderEmail = Sender_Email || req.userEmail || null;
        const effectiveSenderName = "TestPerp Aives";
        console.log('Send_Email_With_Template request:', { Template_ID, To_Email, Placeholders, effectiveSenderEmail, effectiveSenderName, hasAttachments: !!(Attachments && Attachments.length), Student_ID });
        
        // Synchronous In-Memory Lock to prevent concurrent duplicate API triggers
        const cleanTmplId = Number(Template_ID) || 0;
        const cleanStudentId = Number(Student_ID) || 0;
        const lockKey = `${cleanTmplId}_${cleanStudentId || (To_Email || '').toLowerCase().trim()}`;
        const now = Date.now();

        if (templateSendLocks.has(lockKey) && (now - templateSendLocks.get(lockKey) < 120000)) {
            console.log(`[Send_Email_With_Template] Duplicate prevented by in-memory lock: Template ${cleanTmplId} to ${cleanStudentId || To_Email}`);
            return res.json({ success: true, skipped: true, duplicatePrevented: true, message: 'Email already sent recently.' });
        }
        templateSendLocks.set(lockKey, now);

        // If this is a registration or assigned staff template and the backend registration lock is active, skip duplicate
        if (cleanStudentId > 0 && isRegistrationLocked(cleanStudentId) && (cleanTmplId === 19 || cleanTmplId === 23)) {
            console.log(`[Send_Email_With_Template] Duplicate prevented: Registration emails already processed by backend for Student ${cleanStudentId} (Template ${cleanTmplId}).`);
            return res.json({ success: true, skipped: true, duplicatePrevented: true, message: 'Registration email already sent by backend.' });
        }

        // 1. Get the template with robust fallbacks for registration & assigned staff emails
        let template = null;
        try {
            const templates = await email_template.Get_Email_Template(Template_ID);
            if (templates && templates.length > 0 && templates[0]) {
                template = templates[0];
            }
        } catch (spErr) {
            console.warn('[Send_Email_With_Template] Get_Email_Template SP warning:', spErr.message);
        }

        // Direct query fallback by Template_ID if SP returned nothing
        if (!template && Template_ID) {
            try {
                const [dbRows] = await db.promise().query(
                    `SELECT * FROM email_templates WHERE Template_ID = ? AND (Delete_Status = 0 OR Delete_Status IS NULL) LIMIT 1`,
                    [Template_ID]
                );
                if (dbRows && dbRows.length > 0) {
                    template = dbRows[0];
                }
            } catch (dbErr) {
                console.warn('[Send_Email_With_Template] Direct query error:', dbErr.message);
            }
        }

        // Determine if this is a registration receipt email or assigned staff email
        const isReceiptFlow = Number(Template_ID) === 19 || (Placeholders && (Placeholders['Roll Number'] || Placeholders['Enrolment Date'] || Placeholders['Payment Amount']));
        const isStaffFlow = Number(Template_ID) === 23 || (Placeholders && (Placeholders['Staff Email'] || Placeholders['Assigned Trainer'] || Placeholders['Trainer Name'] || Placeholders['Staff Name']));

        // Fuzzy match fallback by template name / purpose if hardcoded Template_ID was not matched
        if (!template) {
            try {
                let pattern = '';
                if (isReceiptFlow) {
                    pattern = '%receipt%';
                } else if (isStaffFlow) {
                    pattern = '%staff%';
                }
                if (pattern) {
                    const [matchedRows] = await db.promise().query(
                        `SELECT * FROM email_templates 
                         WHERE Template_Name LIKE ? AND (Delete_Status = 0 OR Delete_Status IS NULL) 
                         ORDER BY (Is_Active = 1) DESC, Template_ID DESC LIMIT 1`,
                        [pattern]
                    );
                    if (matchedRows && matchedRows.length > 0) {
                        template = matchedRows[0];
                        console.log(`[Send_Email_With_Template] Found matching template by pattern "${pattern}":`, template.Template_Name);
                    }
                }
            } catch (err) {}
        }

        // Built-in fallback templates ensuring registration & assigned staff emails NEVER fail
        if (!template) {
            if (isReceiptFlow) {
                console.log('[Send_Email_With_Template] Using built-in fallback template for Registration/Receipt Confirmation.');
                template = {
                    Template_ID: 19,
                    Template_Name: 'Welcome mail with receipt',
                    Subject: "Enrolment Confirmation & Fee Receipt – [Course Name] | Aives Australia's TESTPREP",
                    Body: `Dear [First Name],

Welcome to Aives Australia's TESTPREP! We are delighted to confirm your enrolment in our [Course Name] programme.

**Your Enrolment Details:**
• **Student Name:** [Student Name]
• **Roll Number:** [Roll Number]
• **Programme:** [Course Name]
• **Training Mode:** [Training Mode]
• **Course Commencement:** [Start Date]
• **Daily Training Time:** [Daily Training Time] ([Time Zone])
• **Payment Amount:** [Payment Amount]
• **Transaction Reference:** [Transaction ID]

Attached to this email is your official Payment Receipt for your records.

Our Student Support and Academic Team will guide you through every stage of your preparation. If you have any questions prior to class commencement, please reach out to us at [Official Email] or [Contact Number].

We wish you the very best in achieving your target score!

Warm regards,

**Student Admissions & Administration Team**
**Aives Australia's TESTPREP**
[Official Email] | [Contact Number]`,
                    Is_Active: 1
                };
            } else if (isStaffFlow) {
                console.log('[Send_Email_With_Template] Using built-in fallback template for Assigned Staff/Trainer.');
                template = {
                    Template_ID: 23,
                    Template_Name: 'Assigned Staff',
                    Subject: "Trainer Allocation & Class Schedule – [Course Name] | Aives Australia's TESTPREP",
                    Body: `Dear [First Name],

Greetings from Aives Australia's TESTPREP!

We are pleased to inform you that your trainer has been allocated for the [Course Name] programme.

**Trainer & Class Details:**
• **Assigned Trainer:** [Trainer Name]
• **Trainer Contact:** [Trainer Contact Details]
• **Batch Time:** [Daily Training Time] ([Time Zone])
• **First Class Date:** [Start Date]

Your trainer will guide you throughout the training journey, conduct practice sessions, provide individual feedback, and assist you in achieving your required examination score.

Please be ready for your first session at the scheduled batch time. If you need any assistance, feel free to contact us at [Official Email] or [Contact Number].

Warm regards,

**Academic Coordination Team**
**Aives Australia's TESTPREP**
[Official Email] | [Contact Number]`,
                    Is_Active: 1
                };
            } else {
                console.error('Template not found for ID:', Template_ID);
                return res.status(404).json({ success: false, message: 'Template not found' });
            }
        }

        // Check if the template is active before sending (except for critical registration flows where student must receive receipt/trainer info)
        if (parseInt(template.Is_Active) !== 1 && !isReceiptFlow && !isStaffFlow) {
            console.log(`Template ID ${Template_ID} is inactive (Is_Active=${template.Is_Active}). Skipping email send.`);
            return res.json({ success: true, skipped: true, message: 'Template is inactive. Email not sent.' });
        }

        // Deduplication: prevent sending the exact same template to the same student or email within 2 minutes
        if (To_Email && Template_ID) {
            try {
                const [recentLogs] = await db.promise().query(
                    `SELECT Log_ID FROM email_logs 
                     WHERE (LOWER(TRIM(Email_Address)) = LOWER(TRIM(?)) OR (Student_ID = ? AND ? > 0))
                       AND Template_ID = ? 
                       AND Status = 'Success' 
                       AND Sent_At >= NOW() - INTERVAL 10 MINUTE 
                     LIMIT 1`,
                    [To_Email, Student_ID || 0, Student_ID || 0, Template_ID]
                );
                if (recentLogs && recentLogs.length > 0) {
                    console.log(`[Send_Email_With_Template] Duplicate email prevented: Template ${Template_ID} already sent to ${To_Email} (Student: ${Student_ID}) within last 10 minutes.`);
                    return res.json({ success: true, skipped: true, duplicatePrevented: true, message: 'Email already sent recently.' });
                }
            } catch (dedupeErr) {
                console.warn('[Send_Email_With_Template] Deduplication check warning:', dedupeErr.message);
            }
        }

        let body = template.Body;
        let subject = template.Subject;

        // Resolve student ID and name from DB if not passed directly
        let effectiveStudentId = Student_ID ? Number(Student_ID) : 0;
        let studentName = (Placeholders && (Placeholders['Student Name'] || Placeholders['Student_Name'] || Placeholders['Name'] || Placeholders['Lead Name'] || Placeholders['First Name'])) || '';

        if ((!effectiveStudentId || !studentName) && To_Email) {
            try {
                const [sRows] = await db.promise().query(
                    `SELECT Student_ID, First_Name, Last_Name FROM student 
                     WHERE LOWER(TRIM(Email)) = LOWER(TRIM(?)) AND (Delete_Status = 0 OR Delete_Status IS NULL) 
                     ORDER BY Student_ID DESC LIMIT 1`,
                    [To_Email]
                );
                if (sRows && sRows.length > 0) {
                    if (!effectiveStudentId) effectiveStudentId = sRows[0].Student_ID;
                    if (!studentName) studentName = `${sRows[0].First_Name || ''} ${sRows[0].Last_Name || ''}`.trim();
                }
            } catch (err) {
                console.warn('[Send_Email_With_Template] Student lookup error:', err.message);
            }
        }

        // Check if registration emails were already dispatched or in progress for this student/email
        const isRegTemplate = (cleanTmplId === 19 || cleanTmplId === 23) ||
            (template && template.Template_Name && (
                template.Template_Name.toLowerCase().includes('welcome mail with receipt') ||
                template.Template_Name.toLowerCase().includes('registration completed') ||
                template.Template_Name.toLowerCase().includes('student registration') ||
                template.Template_Name.toLowerCase().includes('assigned staff')
            ));

        if (isRegTemplate) {
            const checkStudentId = effectiveStudentId || cleanStudentId;
            if (isRegistrationLocked(checkStudentId, To_Email)) {
                console.log(`[Send_Email_With_Template] Duplicate registration email prevented for Student ${checkStudentId} (${To_Email}) - Template ${cleanTmplId} (${template?.Template_Name || ''}). Already sent by backend.`);
                return res.json({ success: true, skipped: true, duplicatePrevented: true, message: 'Registration email already dispatched.' });
            }
        }

        // 1b. Fetch Official Contact Info (Email & Phone)
        const contactInfo = await getOfficialContactInfo();
        const officialEmail = effectiveSenderEmail || contactInfo.email;
        const contactNumber = contactInfo.phone;
        const firstName = studentName ? studentName.split(' ')[0] : 'Student';

        // 1c. Resolve Student Enrolment Details dynamically from database
        let admissionNo = (Placeholders && (Placeholders['Student ID'] || Placeholders['CRM ID'] || Placeholders['CRM_ID'] || Placeholders['Admission Number'] || Placeholders['Roll Number'] || Placeholders['Roll_No'])) || '';
        let courseName = (Placeholders && (Placeholders['Programme'] || Placeholders['Course Name'] || Placeholders['Course_Name'])) || '';
        let dynamicTrainingTime = (Placeholders && (Placeholders['Daily Training Time'] || Placeholders['Start Time \u2013 End Time'] || Placeholders['Start Time - End Time'])) || '';
        
        let incomingCourseDuration = (Placeholders && (Placeholders['Course Duration'] || Placeholders['Course_Duration'])) || '';
        if (!incomingCourseDuration && Placeholders && Placeholders['Duration'] && !/hour|minute/i.test(String(Placeholders['Duration']))) {
            incomingCourseDuration = Placeholders['Duration'];
        }
        let incomingSessionDuration = (Placeholders && (Placeholders['Session Duration'] || Placeholders['Class Duration'])) || '';
        if (!incomingSessionDuration && Placeholders && Placeholders['Duration'] && /hour|minute/i.test(String(Placeholders['Duration']))) {
            incomingSessionDuration = Placeholders['Duration'];
        }

        let dynamicDuration = incomingCourseDuration;
        let dynamicSessionDuration = incomingSessionDuration;
        let trainingMode = (Placeholders && (Placeholders['Training Mode'] || Placeholders['Training_Mode'] || Placeholders['Online/Classroom'] || Placeholders['Online / Classroom'])) || '';
        let enrolmentDateFormatted = (Placeholders && (Placeholders['Enrolment Date'] || Placeholders['Enrollment Date'] || Placeholders['Registration Date'] || Placeholders['Date'])) || '';

        if (effectiveStudentId > 0) {
            try {
                const [sDetails] = await db.promise().query(
                    `SELECT s.Roll_No, s.Roll_No_Character, s.Branch_Id, s.Branch_Name, s.Admission_Date, s.Registered_On,
                            b.Branch_Name as Db_Branch_Name
                     FROM student s
                     LEFT JOIN branches b ON s.Branch_Id = b.Branch_Id
                     WHERE s.Student_ID = ? LIMIT 1`,
                    [effectiveStudentId]
                );
                if (sDetails && sDetails.length > 0) {
                    const sRow = sDetails[0];
                    const adm = sRow.Roll_No_Character || sRow.Roll_No;
                    if (adm) admissionNo = adm;

                    if (!trainingMode) {
                        const rawBranch = sRow.Db_Branch_Name || sRow.Branch_Name || '';
                        if (/classroom|offline|in-person|campus/i.test(rawBranch)) {
                            trainingMode = 'Classroom';
                        } else if (/online/i.test(rawBranch)) {
                            trainingMode = 'Online';
                        } else if (rawBranch) {
                            trainingMode = rawBranch;
                        }
                    }

                    if (!enrolmentDateFormatted) {
                        const rawDate = sRow.Admission_Date || sRow.Registered_On;
                        if (rawDate) {
                            const ed = new Date(rawDate);
                            if (!isNaN(ed.getTime())) {
                                enrolmentDateFormatted = `${String(ed.getDate()).padStart(2, '0')}/${String(ed.getMonth() + 1).padStart(2, '0')}/${ed.getFullYear()}`;
                            }
                        }
                    }
                }
            } catch (e) {}

            try {
                const [scInfo] = await db.promise().query(
                    `SELECT sc.Course_ID, sc.Batch_ID, sc.Enrollment_Date, sc.Expiry_Date, 
                            c.Course_Name, c.Validity,
                            cb.Start_Date, cb.End_Date,
                            tts.start_time, tts.end_time 
                     FROM student_course sc 
                     LEFT JOIN course c ON sc.Course_ID = c.Course_ID
                     LEFT JOIN course_batch cb ON sc.Batch_ID = cb.Batch_ID
                     LEFT JOIN teacher_time_slot tts ON sc.Slot_Id = tts.Slot_Id AND IFNULL(tts.Delete_Status, 0) = 0
                     WHERE sc.Student_ID = ? AND (sc.Delete_Status = 0 OR sc.Delete_Status IS NULL)
                     ORDER BY sc.StudentCourse_ID DESC LIMIT 1`,
                    [effectiveStudentId]
                );
                if (scInfo && scInfo.length > 0) {
                    if (!courseName && scInfo[0].Course_Name) courseName = scInfo[0].Course_Name.trim();
                    if (!enrolmentDateFormatted && scInfo[0].Enrollment_Date) {
                        const ed = new Date(scInfo[0].Enrollment_Date);
                        if (!isNaN(ed.getTime())) {
                            enrolmentDateFormatted = `${String(ed.getDate()).padStart(2, '0')}/${String(ed.getMonth() + 1).padStart(2, '0')}/${ed.getFullYear()}`;
                        }
                    }
                    if ((!dynamicTrainingTime || !dynamicSessionDuration) && scInfo[0].start_time && scInfo[0].end_time) {
                        const st = formatTime12h(scInfo[0].start_time);
                        const et = formatTime12h(scInfo[0].end_time);
                        if (!dynamicTrainingTime) dynamicTrainingTime = `${st} \u2013 ${et}`;
                        if (!dynamicSessionDuration) dynamicSessionDuration = calculateDurationString(scInfo[0].start_time, scInfo[0].end_time);
                    }
                    if (!dynamicDuration) {
                        dynamicDuration = formatCourseDuration({
                            validity: scInfo[0].Validity,
                            startDate: scInfo[0].Start_Date || scInfo[0].Enrollment_Date,
                            endDate: scInfo[0].End_Date || scInfo[0].Expiry_Date
                        });
                    }
                }
            } catch (e) {}
        }
        if (!admissionNo && effectiveStudentId > 0) admissionNo = String(effectiveStudentId);
        if (!courseName) courseName = 'PTE Academic Training';
        if (!trainingMode) trainingMode = 'Online';
        if (!dynamicTrainingTime) dynamicTrainingTime = '10:00 AM \u2013 11:15 AM';
        if (!dynamicSessionDuration) dynamicSessionDuration = '1 Hour 15 Minutes';
        if (!dynamicDuration) dynamicDuration = '1 Month';
        if (!enrolmentDateFormatted) {
            const today = new Date();
            enrolmentDateFormatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
        }

        let courseStartDateFormatted = '';
        if (Placeholders && (Placeholders['Course Commencement'] || Placeholders['Start Date'] || Placeholders['First Class Date'])) {
            courseStartDateFormatted = Placeholders['Course Commencement'] || Placeholders['Start Date'] || Placeholders['First Class Date'];
        }
        if (!courseStartDateFormatted && scInfo && scInfo.length > 0 && scInfo[0].Start_Date) {
            const cd = new Date(scInfo[0].Start_Date);
            if (!isNaN(cd.getTime())) {
                courseStartDateFormatted = `${String(cd.getDate()).padStart(2, '0')}/${String(cd.getMonth() + 1).padStart(2, '0')}/${cd.getFullYear()}`;
            }
        }
        if (!courseStartDateFormatted && scInfo && scInfo.length > 0 && scInfo[0].Enrollment_Date) {
            const cd = new Date(scInfo[0].Enrollment_Date);
            if (!isNaN(cd.getTime())) {
                courseStartDateFormatted = `${String(cd.getDate()).padStart(2, '0')}/${String(cd.getMonth() + 1).padStart(2, '0')}/${cd.getFullYear()}`;
            }
        }
        if (!courseStartDateFormatted) {
            courseStartDateFormatted = enrolmentDateFormatted;
        }

        // 2. Replace placeholders if any
        if (!Placeholders) Placeholders = {};
        Placeholders['Official Email'] = Placeholders['Official Email'] || officialEmail;
        Placeholders['Official_Email'] = Placeholders['Official_Email'] || officialEmail;
        Placeholders['Contact Number'] = Placeholders['Contact Number'] || contactNumber;
        Placeholders['Contact_Number'] = Placeholders['Contact_Number'] || contactNumber;
        Placeholders['Contact'] = Placeholders['Contact'] || contactNumber;
        Placeholders['Phone'] = Placeholders['Phone'] || contactNumber;
        Placeholders['First Name'] = Placeholders['First Name'] || firstName;
        Placeholders['First_Name'] = Placeholders['First_Name'] || firstName;
        Placeholders['Student Name'] = Placeholders['Student Name'] || studentName || 'Student';
        Placeholders['Student_Name'] = Placeholders['Student_Name'] || studentName || 'Student';
        Placeholders['Student ID'] = Placeholders['Student ID'] || admissionNo;
        Placeholders['Student_ID'] = Placeholders['Student_ID'] || admissionNo;
        Placeholders['CRM ID'] = Placeholders['CRM ID'] || admissionNo;
        Placeholders['CRM_ID'] = Placeholders['CRM_ID'] || admissionNo;
        Placeholders['Admission Number'] = Placeholders['Admission Number'] || admissionNo;
        Placeholders['Admission_Number'] = Placeholders['Admission_Number'] || admissionNo;
        Placeholders['Roll Number'] = Placeholders['Roll Number'] || admissionNo;
        Placeholders['Roll_No'] = Placeholders['Roll_No'] || admissionNo;
        Placeholders['Programme'] = Placeholders['Programme'] || courseName;
        Placeholders['Course Name'] = Placeholders['Course Name'] || courseName;
        Placeholders['Course_Name'] = Placeholders['Course_Name'] || courseName;
        Placeholders['Duration'] = dynamicDuration;
        Placeholders['Course Duration'] = dynamicDuration;
        Placeholders['Course_Duration'] = dynamicDuration;
        Placeholders['Training Duration'] = dynamicDuration;
        Placeholders['Session Duration'] = dynamicSessionDuration;
        Placeholders['Class Duration'] = dynamicSessionDuration;
        Placeholders['Daily Class Duration'] = dynamicSessionDuration;
        Placeholders['Training Mode'] = Placeholders['Training Mode'] || trainingMode;
        Placeholders['Training_Mode'] = Placeholders['Training_Mode'] || trainingMode;
        Placeholders['Online/Classroom'] = Placeholders['Online/Classroom'] || trainingMode;
        Placeholders['Online / Classroom'] = Placeholders['Online / Classroom'] || trainingMode;
        Placeholders['Date'] = Placeholders['Date'] || enrolmentDateFormatted;
        Placeholders['Enrolment Date'] = Placeholders['Enrolment Date'] || enrolmentDateFormatted;
        Placeholders['Enrolment_Date'] = Placeholders['Enrolment_Date'] || enrolmentDateFormatted;
        Placeholders['Enrollment Date'] = Placeholders['Enrollment Date'] || enrolmentDateFormatted;
        Placeholders['Enrollment_Date'] = Placeholders['Enrollment_Date'] || enrolmentDateFormatted;
        Placeholders['Registration Date'] = Placeholders['Registration Date'] || enrolmentDateFormatted;
        Placeholders['Registration_Date'] = Placeholders['Registration_Date'] || enrolmentDateFormatted;
        Placeholders['Daily Training Time'] = Placeholders['Daily Training Time'] || dynamicTrainingTime;
        Placeholders['Start Time \u2013 End Time'] = Placeholders['Start Time \u2013 End Time'] || dynamicTrainingTime;
        Placeholders['Start Time - End Time'] = Placeholders['Start Time - End Time'] || dynamicTrainingTime;
        Placeholders['Start Date'] = Placeholders['Start Date'] || courseStartDateFormatted;
        Placeholders['Course Commencement'] = Placeholders['Course Commencement'] || courseStartDateFormatted;
        Placeholders['First Class Date'] = Placeholders['First Class Date'] || courseStartDateFormatted;

        Object.keys(Placeholders).forEach(key => {
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\[${escapedKey}\\]`, 'gi');
            const replacementValue = Placeholders[key] !== undefined && Placeholders[key] !== null ? String(Placeholders[key]) : '';
            if (body) body = body.replace(regex, () => replacementValue);
            if (subject) subject = subject.replace(regex, () => replacementValue);
        });

        // Direct fallback regex replacement for standard placeholders if not caught above
        if (body) {
            body = body
                .replace(/\[First[\s_]*Name\]/gi, firstName)
                .replace(/\[Student[\s_]*Name\]/gi, studentName || 'Student')
                .replace(/\[Lead[\s_]*Name\]/gi, studentName || 'Student')
                .replace(/\[Name\]/gi, studentName || 'Student')
                .replace(/\[Email\]/gi, To_Email || '')
                .replace(/\[Official[\s_]*(?:Email|Mail)(?:[\s_]*Address)?\]/gi, officialEmail)
                .replace(/\[(?:Official[\s_]*)?(?:Contact|Phone|Mobile)(?:[\s_]*(?:Number|No))?\]/gi, contactNumber)
                .replace(/\[Student[\s_]*ID\]/gi, admissionNo)
                .replace(/\[CRM[\s_]*ID\]/gi, admissionNo)
                .replace(/\[Programme\]/gi, courseName)
                .replace(/\[Program\]/gi, courseName)
                .replace(/\[Course[\s_]*Name\]/gi, courseName)
                .replace(/Programme:\s*PTE Academic Training/gi, `Programme: ${courseName}`)
                .replace(/Programme:\tPTE Academic Training/gi, `Programme:\t${courseName}`)
                .replace(/\[Duration\]/gi, dynamicDuration)
                .replace(/\[(?:Course|Training)[\s_]*Duration\]/gi, dynamicDuration)
                .replace(/\[(?:Session|Class)[\s_]*Duration\]/gi, dynamicSessionDuration)
                .replace(/(•\s*Duration:\s*)1 Hour 15 Minutes/gi, `$1${dynamicDuration}`)
                .replace(/(Duration:\s*)1 Hour 15 Minutes/gi, `$1${dynamicDuration}`)
                .replace(/\[Online\s*[\/\\]\s*Classroom\]/gi, trainingMode)
                .replace(/\[Training[\s_]*Mode\]/gi, trainingMode)
                .replace(/\[Date\]/gi, enrolmentDateFormatted)
                .replace(/\[Enrolment[\s_]*Date\]/gi, enrolmentDateFormatted)
                .replace(/\[Enrollment[\s_]*Date\]/gi, enrolmentDateFormatted)
                .replace(/\[Registration[\s_]*Date\]/gi, enrolmentDateFormatted)
                .replace(/\[Admission[\s_]*(?:Number|No)\]/gi, admissionNo)
                .replace(/\[Roll[\s_]*(?:Number|No)\]/gi, admissionNo)
                .replace(/\[Start[\s_]*Time[\s\u2013\-—]+End[\s_]*Time\]/gi, dynamicTrainingTime)
                .replace(/\[Daily[\s_]*Training[\s_]*Time\]/gi, dynamicTrainingTime)
                .replace(/\[Time[\s_]*Zone\]/gi, 'IST');
        }
        if (subject) {
            subject = subject
                .replace(/\[First[\s_]*Name\]/gi, firstName)
                .replace(/\[Student[\s_]*Name\]/gi, studentName || 'Student')
                .replace(/\[Lead[\s_]*Name\]/gi, studentName || 'Student')
                .replace(/\[Name\]/gi, studentName || 'Student')
                .replace(/\[Email\]/gi, To_Email || '')
                .replace(/\[Official[\s_]*(?:Email|Mail)(?:[\s_]*Address)?\]/gi, officialEmail)
                .replace(/\[(?:Official[\s_]*)?(?:Contact|Phone|Mobile)(?:[\s_]*(?:Number|No))?\]/gi, contactNumber)
                .replace(/\[Student[\s_]*ID\]/gi, admissionNo)
                .replace(/\[CRM[\s_]*ID\]/gi, admissionNo)
                .replace(/\[Programme\]/gi, courseName)
                .replace(/\[Program\]/gi, courseName)
                .replace(/\[Course[\s_]*Name\]/gi, courseName)
                .replace(/Programme:\s*PTE Academic Training/gi, `Programme: ${courseName}`)
                .replace(/Programme:\tPTE Academic Training/gi, `Programme:\t${courseName}`)
                .replace(/\[Duration\]/gi, dynamicDuration)
                .replace(/\[(?:Course|Training)[\s_]*Duration\]/gi, dynamicDuration)
                .replace(/\[(?:Session|Class)[\s_]*Duration\]/gi, dynamicSessionDuration)
                .replace(/\[Online\s*[\/\\]\s*Classroom\]/gi, trainingMode)
                .replace(/\[Training[\s_]*Mode\]/gi, trainingMode)
                .replace(/\[Date\]/gi, enrolmentDateFormatted)
                .replace(/\[Enrolment[\s_]*Date\]/gi, enrolmentDateFormatted)
                .replace(/\[Enrollment[\s_]*Date\]/gi, enrolmentDateFormatted)
                .replace(/\[Registration[\s_]*Date\]/gi, enrolmentDateFormatted)
                .replace(/\[Admission[\s_]*(?:Number|No)\]/gi, admissionNo)
                .replace(/\[Roll[\s_]*(?:Number|No)\]/gi, admissionNo)
                .replace(/\[Start[\s_]*Time[\s\u2013\-—]+End[\s_]*Time\]/gi, dynamicTrainingTime)
                .replace(/\[Daily[\s_]*Training[\s_]*Time\]/gi, dynamicTrainingTime)
                .replace(/\[Time[\s_]*Zone\]/gi, 'IST');
        }

        // 2b. If template contains verification buttons or lead-response links, ensure they are personalized for THIS student
        if ((effectiveStudentId > 0 || To_Email) && (
            template.Template_Name === 'Lead Welcome & Response Form' ||
            (body && body.includes('/lead-response')) ||
            (body && body.includes('[Response Buttons]')) ||
            (body && body.includes('[YES, I AM INTERESTED')) ||
            (body && body.includes('[YES, I WOULD LIKE TO DISCUSS')) ||
            (body && /\[YES,[\s\S]*?(?:OPTIONS|ENQUIRY)\]/i.test(body)) ||
            (body && /✓\s*YES,\s*I/i.test(body)) ||
            (body && /Open verification form/i.test(body))
        )) {
            const { interestedUrl, notInterestedUrl, responseFormUrl, buttonsHtml } = buildLeadResponseBlock({
                studentId: effectiveStudentId,
                email: To_Email,
                name: studentName,
                req: req
            });

            // Strip any old button tables or containers that may exist in saved templates
            body = body
                .replace(/<table[^>]*role="presentation"[^>]*>[\s\S]*?(?:DISCUSS MY PTE TRAINING OPTIONS|OPTIONS|ENQUIRY)[\s\S]*?<\/table>/gi, buttonsHtml)
                .replace(/<table[^>]*>[\s\S]*?Open verification form[\s\S]*?<\/table>/gi, buttonsHtml);

            // Dynamically rewrite any existing lead-response links (stripping stale/hardcoded links)
            body = body
                .replace(/href=["'][^"']*\/lead-response[^"']*choice=(?:Interested|yes)[^"']*["']/gi, `href="${interestedUrl}"`)
                .replace(/href=["'][^"']*\/lead-response[^"']*choice=(?:Not[+_]Interested|no)[^"']*["']/gi, `href="${notInterestedUrl}"`)
                .replace(/href=["'][^"']*\/lead-response[^"']*["']/gi, (m) => {
                    if (m.toLowerCase().includes('choice=not')) return `href="${notInterestedUrl}"`;
                    if (m.toLowerCase().includes('choice=')) return `href="${interestedUrl}"`;
                    return `href="${responseFormUrl}"`;
                });

            if (body.includes('[YES, I WOULD LIKE TO DISCUSS MY PTE TRAINING OPTIONS]')) {
                body = body.replace(/\[YES, I WOULD LIKE TO DISCUSS MY PTE TRAINING OPTIONS\]/g, buttonsHtml);
            } else if (body.includes('[YES, I AM INTERESTED – VERIFY MY ENQUIRY]')) {
                body = body.replace(/\[YES, I AM INTERESTED – VERIFY MY ENQUIRY\]/g, buttonsHtml);
            } else if (body.includes('[YES, I AM INTERESTED - VERIFY MY ENQUIRY]')) {
                body = body.replace(/\[YES, I AM INTERESTED - VERIFY MY ENQUIRY\]/g, buttonsHtml);
            } else if (body.includes('[Response Buttons]')) {
                body = body.replace(/\[Response Buttons\]/g, buttonsHtml);
            } else if (/\[YES,[\s\S]*?(?:OPTIONS|ENQUIRY)\]/i.test(body)) {
                body = body.replace(/\[YES,[\s\S]*?(?:OPTIONS|ENQUIRY)\]/gi, buttonsHtml);
            } else if (/✓\s*YES,\s*I[\s\S]*?(?:OPTIONS|ENQUIRY)/i.test(body)) {
                body = body.replace(/✓\s*YES,\s*I[\s\S]*?(?:OPTIONS|ENQUIRY)/gi, buttonsHtml);
            }
        }

        // 3. Send email
        console.log('Attempting to send email to:', To_Email);
        const htmlBody = body ? body.replace(/\n/g, '<br>') : '';
        const sendResult = await emailHelper.sendEmail(To_Email, subject, htmlBody, effectiveSenderEmail, effectiveSenderName, Attachments);
        console.log('Email sent successfully');

        if (effectiveStudentId || Student_ID) {
            try {
                await emailLog.Save_Email_Log(
                    effectiveStudentId || Student_ID,
                    template.Template_ID,
                    To_Email,
                    subject,
                    sendResult?.messageId || null,
                    htmlBody,
                    'Success',
                    null
                );
            } catch (logErr) {
                console.error('Error saving email log:', logErr.message);
            }
        }

        res.json({ success: true, message: 'Email sent successfully', messageId: sendResult?.messageId || null });
    } catch (e) {
        console.error('Error sending template email:', e.message);
        let detailedError = e.message;
        if (e.responseData) {
            console.error('Brevo API Error Data:', e.responseData);
            detailedError = typeof e.responseData === 'string' ? e.responseData : JSON.stringify(e.responseData);
        }

        if (req.body?.Student_ID) {
            try {
                await emailLog.Save_Email_Log(
                    req.body.Student_ID,
                    req.body.Template_ID || null,
                    req.body.To_Email,
                    (typeof subject !== 'undefined' && subject ? subject : (typeof template !== 'undefined' && template?.Subject ? template.Subject : 'Template Email')),
                    null,
                    detailedError,
                    'Failed',
                    detailedError
                );
            } catch (logErr) {
                console.error('Error saving email log on failure:', logErr.message);
            }
        }

        res.status(500).json({ success: false, message: 'Failed to send email', error: detailedError });
    }
});

module.exports = router;
