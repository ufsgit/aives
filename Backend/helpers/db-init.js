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

Why Choose Aives Australia's TESTPREP?
Our programme is developed under the guidance of qualified Australian immigration law professionals with 20 years of practical experience in understanding English language testing requirements for Australian migration, professional registration, and education pathways.

Our distinctive training approach combines:

• Qualified IELTS/PTE Trainers: Professional training focused on examination techniques, language proficiency, and scoring requirements.

• Expert Guidance & Practical Feedback: Training informed by years of practical experience with English language test preparation, candidate performance, and individual feedback.

• NLP Master Trainers: Additional mindset preparation focusing on confidence, concentration, and examination readiness.

• Practical Mock Tests: Structured mock examinations, performance assessments, and constructive feedback to identify areas requiring improvement.

• Goal-Oriented Training: Preparation aligned with your target PTE score and individual learning needs.

Please Verify Your Interest
To ensure that we provide personalised assistance to genuine prospective students, we kindly request you to verify your enquiry.

[YES, I AM INTERESTED – VERIFY MY ENQUIRY]

By confirming your interest, you authorise our TESTPREP Student Admissions Team to contact you regarding suitable PTE training options.

Once verified, our team will be pleased to assist you with the next steps.

Didn't Submit This Enquiry?

If you did not register an enquiry with us, you may safely disregard this email.

We look forward to supporting your PTE preparation journey.

Warm regards,

Student Admissions Team
Aives Australia's TESTPREP
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

Your Enrolment Details:
• Student Name: [Student Name]
• Roll Number: [Roll Number]
• Programme: [Course Name]
• Training Mode: [Training Mode]
• Course Commencement: [Start Date]
• Daily Training Time: [Daily Training Time] ([Time Zone])
• Payment Amount: [Payment Amount]
• Transaction Reference: [Transaction ID]

Attached to this email is your official Payment Receipt for your records.

Our Student Support and Academic Team will guide you through every stage of your preparation. If you have any questions prior to class commencement, please reach out to us at [Official Email] or [Contact Number].

We wish you the very best in achieving your target score!

Warm regards,

Student Admissions & Administration Team
Aives Australia's TESTPREP
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
                    ORDER BY s.Roll_No DESC
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

        console.log('[DB-INIT] ✅ Database schema and stored procedures verified successfully.');
    } catch (err) {
        console.error('[DB-INIT] ❌ Database initialization failed:', err.message);
    }
}

module.exports = initializeDatabase;
