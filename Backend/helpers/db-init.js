const db = require('../config/dbconnection');

/**
 * Self-healing database initializer
 * Runs idempotently on server start in all environments (local & live/production)
 */
async function initializeDatabase() {
    try {
        // 1. Ensure lead_response table exists
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS lead_response (
                Response_ID INT AUTO_INCREMENT PRIMARY KEY,
                Student_ID INT NOT NULL,
                Email VARCHAR(255) NOT NULL,
                Full_Name VARCHAR(255) NULL,
                Phone_Number VARCHAR(50) NULL,
                Response_Choice VARCHAR(50) DEFAULT NULL,
                Interested_Course VARCHAR(255) NULL,
                Preferred_Mode VARCHAR(100) NULL,
                Preferred_Time VARCHAR(100) NULL,
                Target_Timeline VARCHAR(100) NULL,
                Comments TEXT NULL,
                Raw_Response JSON NULL,
                Submitted_At DATETIME DEFAULT CURRENT_TIMESTAMP,
                Delete_Status TINYINT DEFAULT 0,
                INDEX idx_student_id (Student_ID),
                INDEX idx_email (Email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 2. Ensure Response_Choice column exists (if table was created with older schema)
        try {
            const [columns] = await db.promise().query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                  AND TABLE_NAME = 'lead_response' 
                  AND COLUMN_NAME = 'Response_Choice'
            `);
            if (columns.length === 0) {
                await db.promise().query(`
                    ALTER TABLE lead_response 
                    ADD COLUMN Response_Choice VARCHAR(50) DEFAULT NULL AFTER Phone_Number
                `);
                console.log('[DB-INIT] Added Response_Choice column to lead_response.');
            }
        } catch (colErr) {
            console.warn('[DB-INIT] Warning checking Response_Choice column:', colErr.message);
        }

        // 3. Ensure Welcome Email Template exists in email_templates table
        try {
            const [templates] = await db.promise().query(`
                SELECT Template_ID 
                FROM email_templates 
                WHERE Template_Name = 'Lead Welcome & Response Form' 
                  AND (Delete_Status = 0 OR Delete_Status IS NULL) 
                LIMIT 1
            `);

            const latestTemplateSubject = "Verify Your PTE Academic Enquiry | Aives Australia's TESTPREP";
            const latestTemplateBody = `Dear [First Name],
Greetings from Aives Australia's TESTPREP!

Thank you for expressing your interest in our PTE Academic Training Programme.

We have received your enquiry and would like to confirm your genuine interest before connecting you with our Student Admissions Team.

**Why Choose Aives Australia's TESTPREP?**
Our programme is developed under the guidance of **qualified Australian immigration law professionals with 20 years of practical experience in understanding English language testing requirements for Australian migration, professional registration, and education pathways.**

**Our distinctive training approach combines:**

• **Qualified IELTS/PTE Trainers:** Professional training focused on examination techniques, language proficiency, and scoring requirements.

• **Expert Guidance & Practical Feedback:** Training informed by years of practical experience with English language test preparation, candidate performance, and individual feedback.

• **NLP Master Trainers:** Additional mindset preparation focusing on confidence, concentration, and examination readiness.

• **Practical Mock Tests:** Structured mock examinations, performance assessments, and constructive feedback to identify areas requiring improvement.

• **Goal-Oriented Training:** Preparation aligned with your target PTE score and individual learning needs.

**Please Verify Your Interest**
To ensure that we provide personalised assistance to genuine prospective students, we kindly request you to verify your enquiry.

[YES, I AM INTERESTED – VERIFY MY ENQUIRY]

By confirming your interest, you authorise our TESTPREP Student Admissions Team to contact you regarding suitable PTE training options.

Once verified, our team will be pleased to assist you with the next steps.

**Didn't Submit This Enquiry?**

If you did not register an enquiry with us, you may safely disregard this email.

We look forward to supporting your PTE preparation journey.

Warm regards,

**Student Admissions Team**
**Aives Australia's TESTPREP**
[Official Email] | [Contact Number]`;
            if (templates.length === 0) {
                await db.promise().query(`
                    INSERT INTO email_templates (
                        Template_Name, Subject, Body, Category, Status, Created_Date, Delete_Status, Is_Active
                    ) VALUES (
                        'Lead Welcome & Response Form',
                        ?,
                        ?,
                        'Leads',
                        'Active',
                        NOW(),
                        0,
                        1
                    )
                `, [latestTemplateSubject, latestTemplateBody]);
                console.log('[DB-INIT] Seeded "Lead Welcome & Response Form" email template.');
            } else {
                // Ensure existing template is up to date and does not contain hardcoded links or stale recipient IDs
                await db.promise().query(
                    `UPDATE email_templates SET Subject = ?, Body = ? WHERE Template_ID = ?`,
                    [latestTemplateSubject, latestTemplateBody, templates[0].Template_ID]
                );
                console.log('[DB-INIT] Verified and updated "Lead Welcome & Response Form" email template.');
            }

            // Also clean up any other templates that may contain legacy button HTML tables or Open verification form
            await db.promise().query(`
                UPDATE email_templates 
                SET Body = REPLACE(REPLACE(Body, '<table role="presentation"', '<div style="display:none"'), 'Open verification form', '')
                WHERE Body LIKE '%Open verification form%' AND Template_Name != 'Lead Welcome & Response Form'
            `).catch(() => {});
        } catch (tmplErr) {
            console.warn('[DB-INIT] Warning verifying email template:', tmplErr.message);
        }
            // 3b. Ensure Registration Confirmation ('Welcome mail with receipt') Template exists
            try {
                const [receiptTemplates] = await db.promise().query(
                    `SELECT Template_ID FROM email_templates 
                     WHERE (Template_Name LIKE '%receipt%' OR Template_Name LIKE '%Welcome mail with receipt%') 
                       AND (Delete_Status = 0 OR Delete_Status IS NULL) LIMIT 1`
                );
                const receiptSubject = "Enrolment Confirmation & Fee Receipt – [Course Name] | Aives Australia's TESTPREP";
                const receiptBody = `Dear [First Name],

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
[Official Email] | [Contact Number]`;

                if (receiptTemplates.length === 0) {
                    await db.promise().query(
                        `INSERT INTO email_templates (
                            Template_ID, Template_Name, Subject, Body, Category, Status, Created_Date, Delete_Status, Is_Active
                        ) VALUES (19, 'Welcome mail with receipt', ?, ?, 'Registration', 'Active', NOW(), 0, 1)
                        ON DUPLICATE KEY UPDATE Template_Name = 'Welcome mail with receipt', Subject = VALUES(Subject), Body = VALUES(Body), Is_Active = 1, Delete_Status = 0`,
                        [receiptSubject, receiptBody]
                    );
                    console.log('[DB-INIT] Seeded "Welcome mail with receipt" email template.');
                } else {
                    await db.promise().query(
                        `UPDATE email_templates SET Is_Active = 1, Delete_Status = 0 WHERE Template_ID = ?`,
                        [receiptTemplates[0].Template_ID]
                    );
                }
            } catch (rErr) {
                console.warn('[DB-INIT] Warning verifying Welcome mail with receipt template:', rErr.message);
            }

            // 3c. Ensure Assigned Staff & Training Details Template exists
            try {
                const [staffTemplates] = await db.promise().query(
                    `SELECT Template_ID FROM email_templates 
                     WHERE (Template_ID = 23 OR Template_Name LIKE '%Student Registration%' OR Template_Name LIKE '%assigned staff%' OR Template_Name LIKE '%assigned trainer%') 
                       AND (Delete_Status = 0 OR Delete_Status IS NULL) LIMIT 1`
                );
                const staffSubject = "Student Registration & Training Details – [Student Name]";
                const staffBody = `Dear [First Name],

Greetings from Aives Australia's TESTPREP!

I am delighted to introduce myself as your assigned PTE Academic Trainer.
I will be conducting your training sessions over the next 20 live sessions helping you understand the PTE Academic examination, develop effective techniques, and improve your performance through structured learning and regular practice.

**Your Training Details**
• **Student Name:** [Student Name]
• **Student ID:** [Student ID]
• **Assigned Trainer:** [Trainer Name]
• **Course Commencement:** [Course Commencement]
• **Daily Training Time:** [Daily Training Time]
• **Time Zone:** [Time Zone]
• **Training Duration:** [Training Duration]

**Your Zoom Classroom Access**
Class link will be shared to you prior to class, Use the same link everyday.

If you have any questions prior to class commencement, please feel free to reach out to us at [Official Email] or [Contact Number].

Warm regards,

**Academic Coordination Team**
**Aives Australia's TESTPREP**
[Official Email] | [Contact Number]`;

                if (staffTemplates.length === 0) {
                    await db.promise().query(
                        `INSERT INTO email_templates (
                            Template_ID, Template_Name, Subject, Body, Category, Status, Created_Date, Delete_Status, Is_Active
                        ) VALUES (23, 'Student Registration & Training Details', ?, ?, 'Registration', 'Active', NOW(), 0, 1)
                        ON DUPLICATE KEY UPDATE Template_Name = 'Student Registration & Training Details', Subject = VALUES(Subject), Body = VALUES(Body), Is_Active = 1, Delete_Status = 0`,
                        [staffSubject, staffBody]
                    );
                    console.log('[DB-INIT] Seeded "Student Registration & Training Details" email template.');
                } else {
                    await db.promise().query(
                        `UPDATE email_templates SET Subject = ?, Body = ?, Is_Active = 1, Delete_Status = 0 WHERE Template_ID = ?`,
                        [staffSubject, staffBody, staffTemplates[0].Template_ID]
                    );
                    console.log('[DB-INIT] Verified and updated "Student Registration & Training Details" email template.');
                }
            } catch (sErr) {
                console.warn('[DB-INIT] Warning verifying Assigned Staff / Registration template:', sErr.message);
            }

            // 3d. Ensure Weekly Attendance email templates (First Week, Second Week, Third Week, Fourth Week) are properly formatted
            try {
                const week1Body = `<p style="margin: 0 0 16px 0;">Dear [Student Name],</p>

<p style="margin: 0 0 16px 0;">Your First Week at TESTPREP – Are You Practising Enough?</p>

<p style="margin: 0 0 16px 0;">Congratulations on completing your first week of PTE Academic training with TESTPREP!</p>

<p style="margin: 0 0 16px 0;">We hope you are enjoying your classes and beginning to understand the structure, 41expectations, and techniques involved in the examination.</p>

<p style="margin: 20px 0 10px 0;"><strong style="font-weight: 700; color: #0f172a;">How Are You Progressing?</strong></p>

<p style="margin: 0 0 10px 0;">We encourage you to reflect on a few important questions:</p>

<ul style="margin: 0 0 16px 0; padding-left: 24px; list-style-type: disc;">
    <li style="margin-bottom: 6px; line-height: 1.65;">Are you comfortable with the techniques introduced by your trainer?</li>
    <li style="margin-bottom: 6px; line-height: 1.65;">Have you started practising independently outside your scheduled classes?</li>
    <li style="margin-bottom: 6px; line-height: 1.65;">Have you identified areas that require additional attention?</li>
    <li style="margin-bottom: 6px; line-height: 1.65;">Are you developing a consistent daily practice routine?</li>
</ul>

<p style="margin: 20px 0 10px 0;"><strong style="font-weight: 700; color: #0f172a;">Understanding the Reality of PTE Academic</strong></p>

<p style="margin: 0 0 14px 0;">Many candidates believe that improving their English proficiency alone will automatically produce their desired PTE score.</p>

<p style="margin: 0 0 14px 0;">However, achieving a target score requires several interconnected skills:</p>

<p style="margin: 0 0 10px 0; line-height: 1.65;"><strong style="font-weight: 700; color: #0f172a;">1. Language Proficiency:</strong> Your ability to understand and communicate effectively in English.</p>

<p style="margin: 0 0 10px 0; line-height: 1.65;"><strong style="font-weight: 700; color: #0f172a;">2. Examination Knowledge:</strong> Understanding the test structure, task instructions, and scoring criteria.</p>

<p style="margin: 0 0 10px 0; line-height: 1.65;"><strong style="font-weight: 700; color: #0f172a;">3. Time Management:</strong> Completing tasks effectively within the prescribed time limits.</p>

<p style="margin: 0 0 10px 0; line-height: 1.65;"><strong style="font-weight: 700; color: #0f172a;">4. Examination Techniques:</strong> Applying suitable strategies while demonstrating the language abilities being assessed.</p>

<p style="margin: 0 0 14px 0; line-height: 1.65;"><strong style="font-weight: 700; color: #0f172a;">5. Consistent Practice:</strong> Developing familiarity, accuracy, fluency, and confidence through regular repetition and feedback.</p>

<p style="margin: 0 0 16px 0;">PTE Academic uses automated scoring for relevant tasks, with assessment criteria varying according to task type. Understanding these criteria can help you prepare more effectively.</p>

<p style="margin: 20px 0 10px 0;"><strong style="font-weight: 700; color: #0f172a;">Have You Considered Additional Practice and Mock Tests?</strong></p>

<p style="margin: 0 0 14px 0;">TESTPREP offers additional practice and mock-test subscription options to complement your instructor-led classes.</p>

<p style="margin: 0 0 10px 0;">These facilities can help you:</p>

<ul style="margin: 0 0 16px 0; padding-left: 24px; list-style-type: disc;">
    <li style="margin-bottom: 6px; line-height: 1.65;">Practise examination-style questions.</li>
    <li style="margin-bottom: 6px; line-height: 1.65;">Become familiar with timed conditions.</li>
    <li style="margin-bottom: 6px; line-height: 1.65;">Identify areas requiring improvement.</li>
    <li style="margin-bottom: 6px; line-height: 1.65;">Monitor your preparation through available practice feedback.</li>
</ul>

<p style="margin: 0 0 16px 0;">If you are interested in subscribing to additional practice or mock-test facilities, please contact our Administration Team.</p>

<p style="margin: 20px 0 10px 0;"><strong style="font-weight: 700; color: #0f172a;">Our Advice for Week Two</strong></p>

<p style="margin: 0 0 14px 0;">Do not wait until the final week to begin serious practice.</p>

<p style="margin: 0 0 14px 0;">The habits you establish today can significantly influence your examination readiness.</p>

<p style="margin: 0 0 20px 0;">We would love to hear how your first week has been. Please share any concerns or areas where you require additional guidance.</p>

<p style="margin: 0 0 16px 0;">Warm regards,</p>

<p style="margin: 0 0 4px 0;"><strong style="font-weight: 700; color: #0f172a;">Student Success Team</strong></p>
<p style="margin: 0;"><strong style="font-weight: 700; color: #0f172a;">TESTPREP</strong></p>`;

                const week2Body = `<p style="margin: 0 0 16px 0;">Dear [Student Name],</p>

<p style="margin: 0 0 16px 0;">Week 2 – Focus, Discipline &amp; Prepare Your Mind for PTE Success</p>

<p style="margin: 0 0 16px 0;">Welcome to your second week of PTE Academic training!</p>

<p style="margin: 0 0 16px 0;">By now, we hope you have developed a clearer understanding of the examination structure and are becoming familiar with the techniques introduced during your classes.</p>

<p style="margin: 0 0 16px 0;">This week, we would like to emphasise three important qualities:</p>

<p style="margin: 0 0 18px 0;"><strong style="font-weight: 700; color: #0f172a;">Focus. Discipline. Consistency.</strong></p>

<p style="margin: 20px 0 10px 0;"><strong style="font-weight: 700; color: #0f172a;">Are You Practising What You Have Learned?</strong></p>

<p style="margin: 0 0 14px 0;">Learning a technique during class and mastering it under examination conditions are two different things.</p>

<p style="margin: 0 0 14px 0;">Your trainer can demonstrate the correct approach, but independent practice helps you develop the speed, accuracy, and confidence required to apply it.</p>

<p style="margin: 0 0 18px 0;">We encourage you to review your class notes, complete assigned exercises, and practise regularly.</p>

<p style="margin: 20px 0 10px 0;"><strong style="font-weight: 700; color: #0f172a;">If You Have Attempted PTE Before</strong></p>

<p style="margin: 0 0 14px 0;">This is an excellent opportunity to reflect on your previous examination experience.</p>

<p style="margin: 0 0 10px 0;">Ask yourself:</p>

<ul style="margin: 0 0 16px 0; padding-left: 24px; list-style-type: disc;">
    <li style="margin-bottom: 6px; line-height: 1.65;">Which tasks did I find particularly challenging?</li>
    <li style="margin-bottom: 6px; line-height: 1.65;">Did I struggle with time management?</li>
    <li style="margin-bottom: 6px; line-height: 1.65;">Did nervousness affect my performance?</li>
    <li style="margin-bottom: 6px; line-height: 1.65;">What changes have I made to my preparation since that attempt?</li>
</ul>

<p style="margin: 0 0 18px 0;">Where available, review your previous score report with your trainer and identify the areas requiring improvement.</p>

<p style="margin: 20px 0 10px 0;"><strong style="font-weight: 700; color: #0f172a;">If This Is Your First PTE Attempt</strong></p>

<p style="margin: 0 0 14px 0;">Your advantage is that you can begin with the right preparation habits.</p>

<p style="margin: 0 0 18px 0;">Become familiar with the examination environment, understand the task requirements, practise with appropriate time limits, and gradually develop confidence through repeated exposure.</p>

<p style="margin: 20px 0 10px 0;"><strong style="font-weight: 700; color: #0f172a;">Prepare Your Mind Alongside Your Skills</strong></p>

<p style="margin: 0 0 14px 0;">Examination preparation is not only about knowledge.</p>

<p style="margin: 0 0 14px 0;">Concentration, emotional regulation, adequate rest, and a calm approach can help you demonstrate your abilities more effectively.</p>

<p style="margin: 0 0 18px 0;">Avoid unnecessary comparisons with other candidates. Focus instead on measurable improvements in your own performance.</p>

<p style="margin: 20px 0 10px 0;"><strong style="font-weight: 700; color: #0f172a;">Your Week Two Challenge</strong></p>

<p style="margin: 0 0 14px 0;">Set a realistic daily practice target, review your mistakes, and discuss any recurring difficulties with your trainer.</p>

<p style="margin: 0 0 14px 0; line-height: 1.65;"><strong style="font-weight: 700; color: #0f172a;">Remember:</strong> Consistent effort is generally more valuable than occasional intensive preparation.</p>

<p style="margin: 0 0 20px 0;">We look forward to seeing your continued progress.</p>

<p style="margin: 0 0 16px 0;">Warm regards,</p>

<p style="margin: 0 0 4px 0;"><strong style="font-weight: 700; color: #0f172a;">Student Success Team</strong></p>
<p style="margin: 0;"><strong style="font-weight: 700; color: #0f172a;">TESTPREP</strong></p>`;

                const week3Body = `<p style="margin: 0 0 16px 0;">Dear [Student Name],</p>

<p style="margin: 0 0 16px 0;"><strong style="font-weight: 700; color: #0f172a;">Week 3 – Transform Your PTE Training into Exam-Ready Performance</strong></p>

<p style="margin: 0 0 16px 0;">You have now reached the third week of your PTE Academic training programme!</p>

<p style="margin: 0 0 16px 0;">This is an important stage in your preparation.</p>

<p style="margin: 0 0 18px 0;">During the initial weeks, your focus may have been on understanding the examination and learning new techniques. Now, it is time to concentrate on applying those techniques consistently and effectively.</p>

<p style="margin: 20px 0 10px 0;"><strong style="font-weight: 700; color: #0f172a;">From Learning to Mastery</strong></p>

<p style="margin: 0 0 14px 0;">Knowing how to complete a task is not the same as performing it accurately under examination conditions.</p>

<p style="margin: 0 0 12px 0;">By this stage, we encourage you to evaluate your progress in the following areas:</p>

<p style="margin: 0 0 10px 0; line-height: 1.65;"><strong style="font-weight: 700; color: #0f172a;">Accuracy:</strong> Are you reducing repeated mistakes?</p>

<p style="margin: 0 0 10px 0; line-height: 1.65;"><strong style="font-weight: 700; color: #0f172a;">Fluency:</strong> Are you becoming more comfortable with speaking and other timed tasks?</p>

<p style="margin: 0 0 10px 0; line-height: 1.65;"><strong style="font-weight: 700; color: #0f172a;">Time Management:</strong> Can you complete practice activities within the required time limits?</p>

<p style="margin: 0 0 10px 0; line-height: 1.65;"><strong style="font-weight: 700; color: #0f172a;">Consistency:</strong> Are your practice results becoming more stable?</p>

<p style="margin: 0 0 18px 0; line-height: 1.65;"><strong style="font-weight: 700; color: #0f172a;">Confidence:</strong> Do you feel more comfortable with the examination format?</p>

<p style="margin: 20px 0 10px 0;"><strong style="font-weight: 700; color: #0f172a;">Your Third-Week Preparation Strategy</strong></p>

<p style="margin: 0 0 10px 0;">We recommend that you:</p>

<ol style="margin: 0 0 18px 0; padding-left: 24px; line-height: 1.65;">
    <li style="margin-bottom: 6px; padding-left: 4px;">Identify your three most challenging task types.</li>
    <li style="margin-bottom: 6px; padding-left: 4px;">Discuss recurring mistakes with your trainer.</li>
    <li style="margin-bottom: 6px; padding-left: 4px;">Practise under timed conditions where appropriate.</li>
    <li style="margin-bottom: 6px; padding-left: 4px;">Review your progress against your original target score.</li>
    <li style="margin-bottom: 6px; padding-left: 4px;">Complete a mock examination if your trainer considers you ready.</li>
</ol>

<p style="margin: 20px 0 10px 0;"><strong style="font-weight: 700; color: #0f172a;">Why Mock Tests Matter</strong></p>

<p style="margin: 0 0 14px 0;">A realistic mock examination can provide valuable information about your current preparation.</p>

<p style="margin: 0 0 14px 0;">It can help you understand how you perform across multiple tasks, manage examination time, and maintain concentration over a longer session.</p>

<p style="margin: 0 0 14px 0;">However, mock-test scores are estimates and may not perfectly predict your official PTE Academic result.</p>

<p style="margin: 0 0 18px 0;">If you have not yet explored TESTPREP's additional practice and mock-test subscription options, our Administration Team will be happy to assist.</p>

<p style="margin: 20px 0 10px 0;"><strong style="font-weight: 700; color: #0f172a;">An Important Reminder</strong></p>

<p style="margin: 0 0 14px 0;">Do not become discouraged if you are still making mistakes.</p>

<p style="margin: 0 0 14px 0;">Mistakes identified during practice provide an opportunity for improvement before the actual examination.</p>

<p style="margin: 0 0 16px 0;">At this stage, quality practice, careful review, and targeted corrections should become your priorities.</p>

<p style="margin: 0 0 20px 0;"><strong style="font-weight: 700; color: #0f172a;">Keep going. Your final phase of preparation is approaching!</strong></p>

<p style="margin: 0 0 16px 0;">Warm regards,</p>

<p style="margin: 0 0 4px 0;"><strong style="font-weight: 700; color: #0f172a;">Student Success Team</strong></p>
<p style="margin: 0;"><strong style="font-weight: 700; color: #0f172a;">TESTPREP</strong></p>`;

                const week4Body = `<p style="margin: 0 0 16px 0;">Dear [Student Name],</p>

<p style="margin: 0 0 14px 0;"><strong style="font-weight: 700; color: #0f172a;">Congratulations!</strong></p>

<p style="margin: 0 0 16px 0;"><strong style="font-weight: 700; color: #0f172a;">You are now approaching the final stage of your PTE Academic training programme with TESTPREP.</strong></p>

<p style="margin: 0 0 14px 0;">Over the past few weeks, you have invested valuable time and effort in understanding the examination, developing your language skills, and practising the techniques introduced by your trainer.</p>

<p style="margin: 0 0 18px 0;">As you approach the completion of your classes, we would like to share some important recommendations.</p>

<p style="margin: 20px 0 10px 0;"><strong style="font-weight: 700; color: #0f172a;">1. Practise, Review and Refine</strong></p>

<p style="margin: 0 0 14px 0;">Your final preparation period should focus on strengthening what you have already learned.</p>

<p style="margin: 0 0 14px 0;">Continue practising regularly, particularly the tasks where you require additional improvement.</p>

<p style="margin: 0 0 14px 0;">Review your trainer's feedback, correct recurring mistakes, and practise managing your time effectively.</p>

<p style="margin: 0 0 18px 0;">Avoid introducing too many unfamiliar strategies immediately before your examination.</p>

<p style="margin: 20px 0 10px 0;"><strong style="font-weight: 700; color: #0f172a;">2. Prepare Yourself Psychologically</strong></p>

<p style="margin: 0 0 14px 0;">Examination performance is influenced not only by knowledge and preparation but also by your ability to maintain concentration, manage nervousness, and remain composed under pressure.</p>

<p style="margin: 0 0 14px 0;">Some well-prepared candidates experience difficulty demonstrating their abilities because of excessive anxiety, negative expectations, or poor examination-day routines.</p>

<p style="margin: 0 0 18px 0;">This is why we encourage students to give appropriate attention to their mental and emotional preparation.</p>

<p style="margin: 20px 0 10px 0;"><strong style="font-weight: 700; color: #0f172a;">3. An Additional Opportunity – TESTPREP's Monthly NLP-Based Exam Readiness Session</strong></p>

<p style="margin: 0 0 14px 0;">As part of our student development initiatives, TESTPREP offers a monthly session incorporating Neuro-Linguistic Programming (NLP)-based techniques, delivered by an NLP Master Trainer.</p>

<p style="margin: 0 0 10px 0;">The session introduces practical approaches to:</p>

<ul style="margin: 0 0 16px 0; padding-left: 24px; list-style-type: disc;">
    <li style="margin-bottom: 6px; line-height: 1.65;">Developing a constructive examination mindset.</li>
    <li style="margin-bottom: 6px; line-height: 1.65;">Recognising and managing unhelpful thought patterns.</li>
    <li style="margin-bottom: 6px; line-height: 1.65;">Building confidence through guided mental preparation.</li>
    <li style="margin-bottom: 6px; line-height: 1.65;">Practising relaxation, concentration, and visualisation exercises.</li>
    <li style="margin-bottom: 6px; line-height: 1.65;">Developing positive examination-day routines.</li>
</ul>

<p style="margin: 0 0 14px 0;">The programme also connects these exercises with practical examination-attending strategies, helping students consider how to approach the test with greater composure and preparation.</p>

<p style="margin: 0 0 18px 0;">Please note that NLP is a supplementary personal-development approach and is not a scientifically established method for improving PTE scores or treating examination anxiety. It does not replace structured training, consistent practice, or appropriate professional support.</p>

<p style="margin: 20px 0 10px 0;"><strong style="font-weight: 700; color: #0f172a;">Interested in Attending? Please RSVP</strong></p>

<p style="margin: 0 0 10px 0;">Our next session details are:</p>

<ul style="margin: 0 0 16px 0; padding-left: 24px; list-style-type: disc;">
    <li style="margin-bottom: 6px; line-height: 1.65;">Date: [Date]</li>
    <li style="margin-bottom: 6px; line-height: 1.65;">Time: [Time]</li>
    <li style="margin-bottom: 6px; line-height: 1.65;">Registration: [RSVP Link]</li>
</ul>

<p style="margin: 0 0 18px 0;">Please confirm your interest by registering through the link above or contacting our Administration Team.</p>

<p style="margin: 20px 0 10px 0;"><strong style="font-weight: 700; color: #0f172a;">4. Our Final Advice Before Your PTE Examination</strong></p>

<ul style="margin: 0 0 18px 0; padding-left: 24px; list-style-type: disc;">
    <li style="margin-bottom: 6px; line-height: 1.65;">Practise consistently without exhausting yourself.</li>
    <li style="margin-bottom: 6px; line-height: 1.65;">Follow your trainer's final recommendations.</li>
    <li style="margin-bottom: 6px; line-height: 1.65;">Ensure you understand the current examination instructions and identification requirements.</li>
    <li style="margin-bottom: 6px; line-height: 1.65;">Get adequate sleep before your examination.</li>
    <li style="margin-bottom: 6px; line-height: 1.65;">Arrive at the test centre with sufficient time.</li>
    <li style="margin-bottom: 6px; line-height: 1.65;">Remain calm and concentrate on one task at a time.</li>
</ul>

<p style="margin: 20px 0 10px 0;"><strong style="font-weight: 700; color: #0f172a;">A Special Message from TESTPREP</strong></p>

<p style="margin: 0 0 14px 0;">Regardless of whether this is your first PTE attempt or another step towards your desired score, remember that preparation is a process of continuous improvement.</p>

<p style="margin: 0 0 14px 0;">We sincerely appreciate the trust you have placed in TESTPREP and our trainers.</p>

<p style="margin: 0 0 16px 0;">On behalf of our entire team, we wish you confidence, clarity, and every success in your upcoming PTE Academic examination.</p>

<p style="margin: 0 0 20px 0;"><strong style="font-weight: 700; color: #0f172a;">Good luck and best wishes!</strong></p>

<p style="margin: 0 0 16px 0;">Warm regards,</p>

<p style="margin: 0 0 4px 0;"><strong style="font-weight: 700; color: #0f172a;">TESTPREP Training &amp; Student Success Team</strong></p>
<p style="margin: 0 0 2px 0; line-height: 1.5; color: #334155;">7994445326</p>
<p style="margin: 0; line-height: 1.5; color: #334155;">7994443028</p>`;

                await db.promise().query(
                    `UPDATE email_templates SET Body = ?, Attendance_Count = 1, Is_Active = 1, Delete_Status = 0 WHERE Template_ID = 11 OR Template_Name = 'First Week at TESTPREP'`,
                    [week1Body]
                );
                await db.promise().query(
                    `UPDATE email_templates SET Body = ?, Attendance_Count = 5, Is_Active = 1, Delete_Status = 0 WHERE Template_ID = 22 OR Template_Name = 'Second Week'`,
                    [week2Body]
                );
                await db.promise().query(
                    `UPDATE email_templates SET Body = ?, Attendance_Count = 10, Is_Active = 1, Delete_Status = 0 WHERE Template_ID = 15 OR Template_Name = 'Third Week'`,
                    [week3Body]
                );
                await db.promise().query(
                    `UPDATE email_templates SET Body = ?, Attendance_Count = 15, Is_Active = 1, Delete_Status = 0 WHERE Template_ID = 17 OR Template_Name = 'Fourth Week'`,
                    [week4Body]
                );
                console.log('[DB-INIT] Verified and updated Weekly Attendance email templates (First, Second, Third, Fourth Week).');
            } catch (wErr) {
                console.warn('[DB-INIT] Warning verifying Weekly Attendance email templates:', wErr.message);
            }


        // 4. Ensure Get_Batch_Mail_Report stored procedure is up-to-date with date filtering and exact sending events
        try {
            await db.promise().query(`
                DROP PROCEDURE IF EXISTS Get_Batch_Mail_Report;
            `);
            await db.promise().query(`
                CREATE PROCEDURE Get_Batch_Mail_Report(
                    IN p_course_id INT,
                    IN p_batch_id INT,
                    IN p_from_date DATE,
                    IN p_to_date DATE
                )
                BEGIN
                    SELECT 
                        am.Course_ID,
                        am.Batch_ID,
                        COALESCE(MAX(am.Course_Name), MAX(c.Course_Name), '') as Course_Name,
                        COALESCE(MAX(am.Batch_Name), MAX(cb.Batch_Name), '') as Batch_Name,
                        MAX(am.Attendance_Date) as Attendance_Date,
                        MAX(el.Sent_At) as Sent_At,
                        IFNULL(MAX(et.Template_Name), el.Subject) as Template_Name,
                        el.Subject,
                        COUNT(DISTINCT el.Log_ID) as Total_Sent,
                        COUNT(DISTINCT CASE WHEN LOWER(el.Status) IN ('success', 'delivered') THEN el.Log_ID END) as Success_Count,
                        COUNT(DISTINCT CASE WHEN LOWER(el.Status) = 'failed' THEN el.Log_ID END) as Failed_Count,
                        COUNT(DISTINCT CASE WHEN el.Opened_At IS NOT NULL THEN el.Log_ID END) as Opened_Count
                    FROM email_logs el
                    LEFT JOIN email_templates et ON el.Template_ID = et.Template_ID
                    JOIN attendance_details ad ON el.Student_ID = ad.Student_ID
                    JOIN attendance_master am ON ad.Attendance_ID = am.Attendance_ID
                        AND (
                            DATE(CONVERT_TZ(el.Sent_At, '+00:00', '+05:30')) = DATE(CONVERT_TZ(IFNULL(am.Created_Date, am.Attendance_Date), '+00:00', '+05:30'))
                            OR DATE(CONVERT_TZ(el.Sent_At, '+00:00', '+05:30')) = DATE(CONVERT_TZ(am.Attendance_Date, '+00:00', '+05:30'))
                            OR ABS(TIMESTAMPDIFF(HOUR, IFNULL(am.Created_Date, am.Attendance_Date), el.Sent_At)) <= 12
                        )
                    LEFT JOIN course c ON am.Course_ID = c.Course_ID
                    LEFT JOIN course_batch cb ON am.Batch_ID = cb.Batch_ID
                    WHERE 
                        (p_course_id = 0 OR am.Course_ID = p_course_id)
                        AND (p_batch_id = 0 OR am.Batch_ID = p_batch_id)
                        AND (
                            (p_from_date IS NULL AND p_to_date IS NULL)
                            OR (
                                (p_from_date IS NULL OR DATE(CONVERT_TZ(el.Sent_At, '+00:00', '+05:30')) >= p_from_date) 
                                AND (p_to_date IS NULL OR DATE(CONVERT_TZ(el.Sent_At, '+00:00', '+05:30')) <= p_to_date)
                            )
                            OR (
                                (p_from_date IS NULL OR DATE(CONVERT_TZ(am.Attendance_Date, '+00:00', '+05:30')) >= p_from_date) 
                                AND (p_to_date IS NULL OR DATE(CONVERT_TZ(am.Attendance_Date, '+00:00', '+05:30')) <= p_to_date)
                            )
                        )
                    GROUP BY am.Course_ID, am.Batch_ID, DATE(CONVERT_TZ(el.Sent_At, '+00:00', '+05:30')), el.Subject
                    ORDER BY MAX(el.Sent_At) DESC;
                END;
            `);
            console.log('[DB-INIT] Verified Get_Batch_Mail_Report stored procedure.');
        } catch (spErr) {
            console.warn('[DB-INIT] Warning verifying Get_Batch_Mail_Report SP:', spErr.message);
        }

        // 5. Ensure Login_Check stored procedure validates Username / First_Name and Password
        try {
            await db.promise().query(`DROP PROCEDURE IF EXISTS Login_Check;`);
            await db.promise().query(`
                CREATE PROCEDURE Login_Check(
                    IN username_ VARCHAR(100),
                    IN Password_ VARCHAR(50),
                    IN Device_ID_ LONGTEXT
                )
                BEGIN
                    DECLARE User_Id_ INT;
                    DECLARE User_Type_Id_ INT;

                    -- Update Device_ID for the user (matching First_Name, Full Name, or Email)
                    UPDATE users 
                    SET Device_ID = Device_ID_
                    WHERE (
                            LOWER(TRIM(First_Name)) = LOWER(TRIM(username_))
                            OR LOWER(TRIM(CONCAT(TRIM(First_Name), ' ', TRIM(IFNULL(Last_Name, ''))))) = LOWER(TRIM(username_))
                            OR LOWER(TRIM(CONCAT(TRIM(First_Name), TRIM(IFNULL(Last_Name, ''))))) = LOWER(TRIM(username_))
                            OR LOWER(TRIM(Email)) = LOWER(TRIM(username_))
                          )
                      AND Password = Password_ 
                      AND Delete_Status = 0
                    LIMIT 1;
                    
                    -- Get User_ID for the authenticated user
                    SELECT User_ID, User_Type_Id INTO User_Id_, User_Type_Id_
                    FROM users
                    WHERE (
                            LOWER(TRIM(First_Name)) = LOWER(TRIM(username_))
                            OR LOWER(TRIM(CONCAT(TRIM(First_Name), ' ', TRIM(IFNULL(Last_Name, ''))))) = LOWER(TRIM(username_))
                            OR LOWER(TRIM(CONCAT(TRIM(First_Name), TRIM(IFNULL(Last_Name, ''))))) = LOWER(TRIM(username_))
                            OR LOWER(TRIM(Email)) = LOWER(TRIM(username_))
                          )
                      AND Password = Password_ 
                      AND Delete_Status = 0
                    ORDER BY 
                        CASE 
                            WHEN LOWER(TRIM(CONCAT(TRIM(First_Name), ' ', TRIM(IFNULL(Last_Name, ''))))) = LOWER(TRIM(username_)) THEN 1
                            WHEN LOWER(TRIM(First_Name)) = LOWER(TRIM(username_)) THEN 2
                            ELSE 3
                        END,
                        User_ID DESC
                    LIMIT 1;
                    
                    -- If user exists (User_Id_ is not NULL), proceed with live_class updates
                    IF User_Type_Id_ = 2
                    THEN
                        UPDATE live_class
                        SET End_Time = Start_Time, Is_Finished = 1
                        WHERE Is_Finished = 0 AND Teacher_ID = User_Id_;
                        
                        UPDATE call_history
                        SET call_end = call_start, Is_Finished = 1
                        WHERE Is_Finished = 0 AND teacher_id = User_Id_ AND Is_Student_Called = 0;
                        
                        UPDATE student_live_class 
                        SET 
                            End_Time = (
                                SELECT Start_Time  
                                FROM live_class 
                                WHERE live_class.LiveClass_ID = student_live_class.LiveClass_ID
                            )
                        WHERE 
                            LiveClass_ID IN (
                                SELECT LiveClass_ID 
                                FROM live_class 
                                WHERE Is_Finished = 1
                            );
                    END IF;
                    
                    -- Return the user details after login
                    SELECT User_ID AS Id, First_Name, Email, PhoneNumber, User_Type_Id
                    FROM users
                    WHERE (
                            LOWER(TRIM(First_Name)) = LOWER(TRIM(username_))
                            OR LOWER(TRIM(CONCAT(TRIM(First_Name), ' ', TRIM(IFNULL(Last_Name, ''))))) = LOWER(TRIM(username_))
                            OR LOWER(TRIM(CONCAT(TRIM(First_Name), TRIM(IFNULL(Last_Name, ''))))) = LOWER(TRIM(username_))
                            OR LOWER(TRIM(Email)) = LOWER(TRIM(username_))
                          )
                      AND Password = Password_ 
                      AND Delete_Status = 0
                    ORDER BY 
                        CASE 
                            WHEN LOWER(TRIM(CONCAT(TRIM(First_Name), ' ', TRIM(IFNULL(Last_Name, ''))))) = LOWER(TRIM(username_)) THEN 1
                            WHEN LOWER(TRIM(First_Name)) = LOWER(TRIM(username_)) THEN 2
                            ELSE 3
                        END,
                        User_ID DESC
                    LIMIT 1;

                END;
            `);
            console.log('[DB-INIT] Verified Login_Check stored procedure for username authentication.');
        } catch (loginSpErr) {
            console.warn('[DB-INIT] Warning verifying Login_Check SP:', loginSpErr.message);
        }

        // 6. Ensure Search_student stored procedure properly filters by assigned tutor slot or To_User_Id
        try {
            await db.promise().query(`DROP PROCEDURE IF EXISTS Search_student;`);
            await db.promise().query(`
                CREATE PROCEDURE Search_student(
                    IN search_term VARCHAR(100),
                    IN page_number INT,
                    IN page_size INT,
                    IN filter_course_id INT,
                    IN filter_batch_id INT,
                    IN enrollment_status VARCHAR(50),
                    IN active_status VARCHAR(20),
                    IN filter_subscribed VARCHAR(20),
                    IN filter_roll_number VARCHAR(100),
                    IN p_user_id INT,
                    IN p_user_type_id INT
                )
                BEGIN
                    DECLARE offset_value INT;
                    DECLARE v_is_special_admin INT DEFAULT 0;
                    DECLARE v_allowed_staff_list TEXT;

                    SET SESSION sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''));
                    SET search_term = CONCAT('%', IFNULL(search_term, ''), '%');
                    SET offset_value = (IFNULL(page_number, 1) - 1) * IFNULL(page_size, 10);

                    IF enrollment_status IS NULL THEN SET enrollment_status = 'all'; END IF;
                    IF active_status IS NULL THEN SET active_status = 'all'; END IF;
                    IF filter_subscribed IS NULL THEN SET filter_subscribed = 'all'; END IF;

                    IF p_user_type_id = 1 OR p_user_id = 1 THEN
                        SET v_is_special_admin = 1;
                    ELSEIF p_user_id IS NOT NULL AND p_user_id > 0 THEN
                        SELECT IF(COUNT(*) > 0, 1, 0) INTO v_is_special_admin 
                        FROM users 
                        WHERE User_ID = p_user_id 
                          AND (Email = 'admin_user@G.COM' OR Email = 'cs.mgr@testprepinenglish.com' OR User_ID = 1 OR User_Type_Id = 1);

                        WITH RECURSIVE staff_hierarchy AS (
                            SELECT p_user_id as staff_id
                            UNION ALL
                            SELECT sta.staff_user_id as staff_id
                            FROM staff_team_assignment sta
                            INNER JOIN staff_hierarchy sh ON sta.team_lead_user_id = sh.staff_id
                            WHERE sta.staff_user_id <> 1
                        )
                        SELECT GROUP_CONCAT(DISTINCT staff_id) INTO v_allowed_staff_list FROM staff_hierarchy;

                        IF v_allowed_staff_list IS NULL THEN
                            SET v_allowed_staff_list = CAST(p_user_id AS CHAR);
                        END IF;
                    ELSE
                        SET v_is_special_admin = 1;
                    END IF;

                    -- Get total count
                    SELECT COUNT(DISTINCT s.Student_ID) AS total_count
                    FROM student s
                    LEFT JOIN student_course sc ON s.Student_ID = sc.Student_ID AND IFNULL(sc.Delete_Status, 0) = 0
                    LEFT JOIN course_batch cb ON sc.Batch_ID = cb.Batch_ID
                    WHERE
                        s.Delete_Status = false
                        AND (
                            s.First_Name LIKE search_term OR s.Last_Name LIKE search_term OR s.Email LIKE search_term OR
                            s.Phone_Number LIKE search_term OR CONCAT(s.First_Name, ' ', s.Last_Name) LIKE search_term OR
                            CONCAT(s.Last_Name, ' ', s.First_Name) LIKE search_term OR
                            s.Roll_No LIKE search_term OR s.Roll_No_Character LIKE search_term
                        )
                        AND (filter_course_id IS NULL OR sc.Course_ID = filter_course_id)
                        AND (filter_batch_id IS NULL OR cb.Batch_ID = filter_batch_id)
                        AND (
                            enrollment_status = 'all'
                            OR (enrollment_status = 'not_enrolled' AND s.Is_Registered = 1)
                            OR (enrollment_status = 'enrolled' AND s.Is_Registered = 0)
                        )
                        AND (
                            (active_status = 'active' AND s.isActive = 1) OR
                            (active_status = 'deactivated' AND s.isActive = 0) OR
                            (active_status = 'all')
                        )
                        AND (
                            (filter_subscribed = 'yes' AND s.Mock_Test_Subscribed = 1) OR
                            (filter_subscribed = 'no' AND (s.Mock_Test_Subscribed = 0 OR s.Mock_Test_Subscribed IS NULL)) OR
                            (filter_subscribed = 'all')
                        )
                        AND (filter_roll_number IS NULL OR filter_roll_number = '' OR s.Roll_No LIKE CONCAT('%', filter_roll_number, '%') OR s.Roll_No_Character LIKE CONCAT('%', filter_roll_number, '%'))
                        AND (
                            v_is_special_admin = 1
                            OR FIND_IN_SET(s.To_User_Id, v_allowed_staff_list) > 0
                            OR COALESCE(NULLIF(sc.Slot_Id, 0), sc.Requested_Slot_Id) IN (
                                SELECT tts.Slot_Id 
                                FROM teacher_time_slot tts 
                                JOIN course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID 
                                WHERE FIND_IN_SET(ct.Teacher_ID, v_allowed_staff_list) > 0 
                                  AND IFNULL(tts.Delete_Status, 0) = 0 
                                  AND IFNULL(ct.Delete_Status, 0) = 0
                            )
                        );

                    -- Get paginated data
                    SELECT
                        s.Student_ID,
                        s.First_Name,
                        s.Last_Name,
                        s.Email,
                        s.Country_Code,
                        s.Phone_Number,
                        s.Profile_Photo_Path,
                        s.Profile_Photo_Name,
                        s.Branch_Id,
                        s.Branch_Name,
                        s.Status_Name,
                        s.To_User_Name,
                        s.Qualification,
                        s.Follow_Up_Date,
                        s.Remark,
                        s.isActive,
                        s.Is_Registered,
                        s.Roll_No,
                        s.Roll_No_Character,
                        s.Entry_Date,
                        s.Registered_On,
                        s.Delete_Status,
                        s.Mock_Test_Subscribed,
                        s.Mock_Test_Package,
                        s.Admission_Date,
                        s.Enquiry_Source_Id,
                        s.Guardian_Type,
                        s.Guardian_Name,
                        s.Address,
                        MAX(c.Course_Name) AS Course_Name,
                        MAX(cb.Batch_Name) AS Batch_Name,
                        CASE
                            WHEN EXISTS (
                                SELECT 1
                                FROM student_course sc2
                                JOIN course c2 ON sc2.Course_ID = c2.Course_ID
                                WHERE sc2.Student_ID = s.Student_ID
                                AND IFNULL(sc2.Delete_Status, 0) = 0
                                AND c2.Delete_Status = 0
                            ) THEN true
                            ELSE false
                        END AS is_enrolled
                    FROM
                        student s
                    LEFT JOIN student_course sc ON s.Student_ID = sc.Student_ID AND IFNULL(sc.Delete_Status, 0) = 0
                    LEFT JOIN course c ON sc.Course_ID = c.Course_ID
                    LEFT JOIN course_batch cb ON sc.Batch_ID = cb.Batch_ID
                    WHERE
                        s.Delete_Status = false
                        AND (
                            s.First_Name LIKE search_term OR s.Last_Name LIKE search_term OR s.Email LIKE search_term OR
                            s.Phone_Number LIKE search_term OR CONCAT(s.First_Name, ' ', s.Last_Name) LIKE search_term OR
                            CONCAT(s.Last_Name, ' ', s.First_Name) LIKE search_term OR s.Roll_No LIKE search_term OR s.Roll_No_Character LIKE search_term
                        )
                        AND (filter_course_id IS NULL OR sc.Course_ID = filter_course_id)
                        AND (filter_batch_id IS NULL OR cb.Batch_ID = filter_batch_id)
                        AND (
                            enrollment_status = 'all'
                            OR (enrollment_status = 'not_enrolled' AND s.Is_Registered = 1)
                            OR (enrollment_status = 'enrolled' AND s.Is_Registered = 0)
                        )
                        AND (
                            (active_status = 'active' AND s.isActive = 1) OR
                            (active_status = 'deactivated' AND s.isActive = 0) OR
                            (active_status = 'all')
                        )
                        AND (
                            (filter_subscribed = 'yes' AND s.Mock_Test_Subscribed = 1) OR
                            (filter_subscribed = 'no' AND (s.Mock_Test_Subscribed = 0 OR s.Mock_Test_Subscribed IS NULL)) OR
                            (filter_subscribed = 'all')
                        )
                        AND (filter_roll_number IS NULL OR filter_roll_number = '' OR s.Roll_No LIKE CONCAT('%', filter_roll_number, '%') OR s.Roll_No_Character LIKE CONCAT('%', filter_roll_number, '%'))
                        AND (
                            v_is_special_admin = 1
                            OR FIND_IN_SET(s.To_User_Id, v_allowed_staff_list) > 0
                            OR COALESCE(NULLIF(sc.Slot_Id, 0), sc.Requested_Slot_Id) IN (
                                SELECT tts.Slot_Id 
                                FROM teacher_time_slot tts 
                                JOIN course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID 
                                WHERE FIND_IN_SET(ct.Teacher_ID, v_allowed_staff_list) > 0 
                                  AND IFNULL(tts.Delete_Status, 0) = 0 
                                  AND IFNULL(ct.Delete_Status, 0) = 0
                            )
                        )
                    GROUP BY s.Student_ID
                    ORDER BY s.Student_ID DESC
                    LIMIT page_size OFFSET offset_value;
                END;
            `);
            console.log('[DB-INIT] Verified Search_student stored procedure for staff-specific filtering.');
        } catch (searchStudentErr) {
            console.warn('[DB-INIT] Warning verifying Search_student SP:', searchStudentErr.message);
        }

        // 10. Ensure Get_Dashboard stored procedure filters Accounts by Aives branch
        try {
            await db.promise().query(`DROP PROCEDURE IF EXISTS Get_Dashboard;`);
            await db.promise().query(`
                CREATE PROCEDURE Get_Dashboard()
                BEGIN
                    -- 1. Accounts Summary (Only Aives Branch)
                    SELECT 
                        a.account_id,
                        a.account_name,
                        a.total_value_a - COALESCE(b.total_value_b, 0) AS total_value_b
                    FROM (
                        SELECT ah.account_id, ah.account_name, SUM(r.Amount) AS total_value_a
                        FROM account_heads ah
                        JOIN branches br ON ah.Branch_Id = br.Branch_Id 
                            AND IFNULL(br.Delete_Status, 0) = 0 
                            AND (LOWER(br.Branch_Name) = 'aives' OR br.Branch_Id = 5)
                        LEFT JOIN receipts r ON ah.Account_Name = r.Account_Name AND (r.DeleteStatus IS NULL OR r.DeleteStatus = 0)
                        GROUP BY ah.account_id, ah.account_name
                    ) a
                    LEFT JOIN (
                        SELECT ah.account_id, SUM(e.Amount) AS total_value_b
                        FROM account_heads ah
                        JOIN branches br ON ah.Branch_Id = br.Branch_Id 
                            AND IFNULL(br.Delete_Status, 0) = 0 
                            AND (LOWER(br.Branch_Name) = 'aives' OR br.Branch_Id = 5)
                        LEFT JOIN expense e ON e.Account_Name = ah.Account_Name AND (e.Delete_Status IS NULL OR e.Delete_Status = 0)
                        GROUP BY ah.account_id
                    ) b ON a.account_id = b.account_id;

                    -- 2. Popular Course
                    SELECT 
                        c.Course_Name, 
                        COUNT(sc.StudentCourse_ID) AS Enrollment_Count
                    FROM course c
                    LEFT JOIN student_course sc ON c.Course_ID = sc.Course_ID AND IFNULL(sc.Delete_Status, 0) = 0
                    WHERE IFNULL(c.Delete_Status, 0) = 0
                    GROUP BY c.Course_ID, c.Course_Name
                    ORDER BY Enrollment_Count DESC
                    LIMIT 10;

                    -- 3. Month Wise Student Enrollment (Current Year)
                    SELECT 
                        MONTHNAME(COALESCE(sc.Enrollment_Date, s.Admission_Date)) AS Month,
                        COUNT(DISTINCT s.Student_ID) AS Student_Count
                    FROM student s
                    JOIN student_course sc ON s.Student_ID = sc.Student_ID
                    WHERE IFNULL(s.Delete_Status, 0) = 0
                      AND IFNULL(sc.Delete_Status, 0) = 0
                      AND COALESCE(sc.Enrollment_Date, s.Admission_Date) IS NOT NULL
                      AND YEAR(COALESCE(sc.Enrollment_Date, s.Admission_Date)) = YEAR(CURDATE())
                    GROUP BY Month
                    ORDER BY MONTH(STR_TO_DATE(CONCAT('01 ', Month, ' ', YEAR(CURDATE())), '%d %M %Y'));

                    -- 4. DUMMY (Expected as data[3], will be overwritten by backend JS)
                    SELECT 1 AS Dummy;

                    -- 5. Month Wise Lead Report (Current Year)
                    SELECT 
                        MONTHNAME(COALESCE(Entry_Date, Admission_Date)) AS Month,
                        COUNT(Student_ID) AS Lead_Count
                    FROM student
                    WHERE IFNULL(Delete_Status, 0) = 0 
                      AND COALESCE(Entry_Date, Admission_Date) IS NOT NULL
                      AND IFNULL(Is_Registered, 0) = 0
                      AND YEAR(COALESCE(Entry_Date, Admission_Date)) = YEAR(CURDATE())
                    GROUP BY Month
                    ORDER BY MONTH(STR_TO_DATE(CONCAT('01 ', Month, ' ', YEAR(CURDATE())), '%d %M %Y'));

                    -- 6. Student Status Representation (Categorized for Registered Students)
                    SELECT 
                        CASE 
                            WHEN LOWER(Status_Name) = 'completed' THEN 'Completed'
                            WHEN LOWER(Status_Name) IN ('dropout', 'deactivated') THEN 'Dropout'
                            WHEN isActive = 1 THEN 'Active'
                            ELSE 'Dropout'
                        END AS Status, 
                        CAST(COUNT(Student_ID) AS UNSIGNED) AS Count
                    FROM student
                    WHERE IFNULL(Delete_Status, 0) = 0
                      AND Is_Registered = 1
                    GROUP BY Status;

                    -- 7. Total Courses
                    SELECT COUNT(Course_ID) AS Total_Courses
                    FROM course
                    WHERE IFNULL(Delete_Status, 0) = 0;
                END;
            `);
            console.log('[DB-INIT] Verified Get_Dashboard stored procedure (Aives branch filtered).');
        } catch (dashboardSpErr) {
            console.warn('[DB-INIT] Warning verifying Get_Dashboard SP:', dashboardSpErr.message);
        }

        // 11. Ensure Trainer 1, Trainer 2, and Trainer 3 accounts exist with ONLY Attendance permission
        try {
            const trainersConfig = [
                { email: 'trainer1@testprepinenglish.com', altEmail: 'trainer1.admin@testprepinenglish.com', firstName: 'Trainer', lastName: '1', phone: '8974563256' },
                { email: 'trainer2@testprepinenglish.com', altEmail: 'trainer2.admin@testprepinenglish.com', firstName: 'Trainer', lastName: '2', phone: '8974563257' },
                { email: 'trainer3@testprepinenglish.com', altEmail: 'trainer3.admin@testprepinenglish.com', firstName: 'Trainer', lastName: '3', phone: '8741010022' }
            ];

            const trainerUserIds = [];

            for (const t of trainersConfig) {
                let [rows] = await db.promise().query(`SELECT User_ID FROM users WHERE Email = ?`, [t.email]);
                let uid = rows && rows.length > 0 ? rows[0].User_ID : null;
                if (!uid) {
                    const [res] = await db.promise().query(
                        `INSERT INTO users (First_Name, Last_Name, Email, PhoneNumber, Delete_Status, User_Type_Id, password, Branch_Id, Basic_Pay)
                         VALUES (?, ?, ?, ?, 0, 2, '123', 1, '15000.00')`,
                        [t.firstName, t.lastName, t.email, t.phone]
                    );
                    uid = res.insertId;
                } else {
                    await db.promise().query(
                        `UPDATE users SET First_Name = ?, Last_Name = ?, password = '123', User_Type_Id = 2, Delete_Status = 0 WHERE User_ID = ?`,
                        [t.firstName, t.lastName, uid]
                    );
                }
                trainerUserIds.push(uid);

                if (t.altEmail) {
                    let [altRows] = await db.promise().query(`SELECT User_ID FROM users WHERE Email = ?`, [t.altEmail]);
                    let altUid = altRows && altRows.length > 0 ? altRows[0].User_ID : null;
                    if (!altUid) {
                        const [res2] = await db.promise().query(
                            `INSERT INTO users (First_Name, Last_Name, Email, PhoneNumber, Delete_Status, User_Type_Id, password, Branch_Id, Basic_Pay)
                             VALUES (?, ?, ?, ?, 0, 2, '123', 1, '15000.00')`,
                            [t.firstName, t.lastName, t.altEmail, t.phone]
                        );
                        altUid = res2.insertId;
                    } else {
                        await db.promise().query(
                            `UPDATE users SET First_Name = ?, Last_Name = ?, password = '123', User_Type_Id = 2, Delete_Status = 0 WHERE User_ID = ?`,
                            [t.firstName, t.lastName, altUid]
                        );
                    }
                    trainerUserIds.push(altUid);
                }
            }

            const allTrainerIds = [...new Set([...trainerUserIds, 128, 129, 132, 133])].filter(id => id > 0);

            for (const uid of allTrainerIds) {
                await db.promise().query(`DELETE FROM user_menu_selection WHERE User_Id = ? AND Menu_Id != 1016`, [uid]);

                const [check1016] = await db.promise().query(`SELECT User_Menu_Selection_Id FROM user_menu_selection WHERE User_Id = ? AND Menu_Id = 1016`, [uid]);
                if (!check1016 || check1016.length === 0) {
                    await db.promise().query(
                        `INSERT INTO user_menu_selection (Menu_Id, User_Id, IsEdit, IsSave, IsDelete, IsView, DeleteStatus)
                         VALUES (1016, ?, 1, 1, 1, 1, 0)`,
                        [uid]
                    );
                } else {
                    await db.promise().query(
                        `UPDATE user_menu_selection SET IsView = 1, IsEdit = 1, IsSave = 1, IsDelete = 1, DeleteStatus = 0 WHERE User_Id = ? AND Menu_Id = 1016`,
                        [uid]
                    );
                }

                const [activeCourses] = await db.promise().query(`SELECT Course_ID FROM course WHERE Delete_Status = 0`);
                for (const c of activeCourses) {
                    const [ctCheck] = await db.promise().query(
                        `SELECT CourseTeacher_ID FROM course_teacher WHERE Teacher_ID = ? AND Course_ID = ?`,
                        [uid, c.Course_ID]
                    );
                    if (!ctCheck || ctCheck.length === 0) {
                        await db.promise().query(
                            `INSERT INTO course_teacher (Course_ID, Teacher_ID, Delete_Status) VALUES (?, ?, 0)`,
                            [c.Course_ID, uid]
                        );
                    } else {
                        await db.promise().query(
                            `UPDATE course_teacher SET Delete_Status = 0 WHERE Teacher_ID = ? AND Course_ID = ?`,
                            [uid, c.Course_ID]
                        );
                    }
                }
            }

            console.log('[DB-INIT] Verified Trainer 1, Trainer 2, and Trainer 3 accounts with ONLY Attendance permission.');
        } catch (trainerInitErr) {
            console.warn('[DB-INIT] Warning setting up trainers in db-init:', trainerInitErr.message);
        }

        console.log('[DB-INIT] ✅ Database schema and stored procedures verified successfully.');
    } catch (err) {
        console.error('[DB-INIT] ❌ Database initialization failed:', err.message);
    }
}

module.exports = initializeDatabase;
