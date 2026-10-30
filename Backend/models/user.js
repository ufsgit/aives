var fs = require('fs');
const { executeTransaction, getmultipleSP } = require('../helpers/sp-caller');
const db = require('../config/dbconnection');

function normalizeDateBounds(fromDate, toDate) {
    return {
        fromDate: fromDate || null,
        toDate: toDate || null,
    };
}

var user = {
    Save_user: async function (user) {
        return executeTransaction('Save_User', [
            user.User_ID,
            user.First_Name,
            user.Last_Name,
            user.Email,
            user.PhoneNumber,
            user.Delete_Status,
            user.User_Type_Id,
            user.User_Role_Id,
            user.Branch_Id,
            user.User_Status,
            user.password,
            user.Device_ID,
            user.Profile_Photo_Name,
            user.Profile_Photo_Path,
            JSON.stringify(user.Course_ID),
            user.Hod,
            JSON.stringify(user.teacherCourses),
            user.Basic_Pay || null
        ]);
    },

    Save_Leave: async function (leave) {
        return executeTransaction('Save_Leave', [
            leave.Leave_Id || 0,
            leave.User_Id,
            leave.From_Date,
            leave.To_Date,
            leave.Reason,
            leave.Status || 'Pending'
        ]);
    },

    Get_Leaves: async function (user_Id) {
        return executeTransaction('Get_Leaves', [user_Id || 0]);
    },

    Delete_Leave: async function (leave_Id) {
        return executeTransaction('Delete_Leave', [leave_Id]);
    },

    Save_StudentLiveClass: async function (student) {
        return executeTransaction('Save_StudentLiveClass', [student.StudentLiveClass_ID, student.Student_ID, student.LiveClass_ID, student.Start_Time, student.End_Time, student.Attendance_Duration]);
    },
    Update_Call_Status: async function (callId, type, status, user_Id = 0, isStudent = 0) {
        try {
            const result = await executeTransaction('Update_Call_Status', [callId, type, status, user_Id, isStudent]);
            return result;
        } catch (error) {
            console.error('Error executing Update_Call_Status:', error);
            throw new Error('Error updating call status');
        }
    },

    Save_Call_History: async function (call) {
        return executeTransaction('Save_Call_History', [call.id, call.teacher_id, call.student_id, call.call_start, call.call_end, call.call_duration, call.call_type, call.Is_Student_Called, call.Live_Link, call.is_call_rejected]);
    },
    Delete_user: async function (user_Id_) {
        return executeTransaction('Delete_User', [user_Id_]);
    },
    // Get_All_Menu_Permissions
    Get_All_Menu_Permissions: async function (user_Id_) {
        return getmultipleSP('Get_All_Menu_Permissions', [user_Id_]);
    },
    Get_user_Menus: async function (user_Id_) {
        return getmultipleSP('Get_user_Menus', [user_Id_]);
    },

    Get_user: async function (user_Id_) {
        return executeTransaction('Get_user', [user_Id_]);
    },
    Search_user: async function (params) {
        const {
            user_Name,
            slot_wise,
            batch_wise,
            course_id,
            hod_only
        } = params;

        // Handle undefined search term
        const searchTerm = user_Name === undefined || user_Name === 'undefined' ? '' : user_Name;

        // Pass all parameters to the stored procedure
        return executeTransaction('Search_User', [
            searchTerm,
            slot_wise,
            batch_wise,
            course_id,
            hod_only
        ]);
    },
    Get_Dashboard: async function () {

        return getmultipleSP('Get_Dashboard', []);
    },
    Get_Dashboard_Course_Wise_Monthly_Enrollment: async function () {
        const sql = `
            SELECT
                c.Course_Name,
                MONTHNAME(COALESCE(sc.Enrollment_Date, s.Admission_Date)) AS Month,
                COUNT(DISTINCT sc.Student_ID) AS Student_Count
            FROM course c
            INNER JOIN student_course sc
                ON c.Course_ID = sc.Course_ID
            INNER JOIN student s
                ON s.Student_ID = sc.Student_ID
            WHERE (c.Delete_Status IS NULL OR c.Delete_Status = 0)
              AND (sc.Delete_Status IS NULL OR sc.Delete_Status = 0)
              AND (s.Delete_Status IS NULL OR s.Delete_Status = 0)
              AND (sc.Expiry_Date IS NULL OR DATE(sc.Expiry_Date) >= CURDATE())
              AND COALESCE(sc.Enrollment_Date, s.Admission_Date) IS NOT NULL
            GROUP BY
                c.Course_ID,
                c.Course_Name,
                MONTH(COALESCE(sc.Enrollment_Date, s.Admission_Date)),
                MONTHNAME(COALESCE(sc.Enrollment_Date, s.Admission_Date))
            ORDER BY
                c.Course_Name,
                MONTH(COALESCE(sc.Enrollment_Date, s.Admission_Date));
        `;

        const [rows] = await db.promise().query(sql);
        return rows;
    },
    Get_courses: async function (student_Id_) {
        return executeTransaction('GetCoursesByUserId', [student_Id_]);
    },
    Get_Calls_And_Chats_List: async function (type, sender, teacherId, studentId) {
        return executeTransaction('Get_Calls_And_Chats_List', [type, sender, teacherId, studentId]);
    },
    Logout_User: async function (userId, isStudent) {
        return executeTransaction('Logout_User', [userId, isStudent]);
    },
    get_call_history: async function (studentId, teacherId) {
        console.log('studentId:s ', studentId);
        console.log('teacherId: ', teacherId);
        return executeTransaction('get_call_history', [studentId, teacherId]);
    },
    Get_Ongoing_Calls: async function (userId, isStudent) {
        console.log('isStudent: ', isStudent);
        console.log('userId: ', userId);

        return executeTransaction('Get_Ongoing_Calls', [userId, isStudent]);
    },
    Get_Completed_Live_Class: async function (userId) {
        console.log('userId: ', userId);
        return executeTransaction('Get_Completed_liveClass', [userId]);
    },
    Get_Report_StudentLiveClasses_By_BatchAndStudent: async function (
        studentId,
        Batch_ID,
        Course_ID,
        Start_Date,
        End_Date,
        page,
        pageSize
    ) {
        studentId = studentId || 0;
        Batch_ID = Batch_ID || 0;
        Course_ID = Course_ID || 0;
        Start_Date = Start_Date || '';
        End_Date = End_Date || '';
        page = page || 1;
        pageSize = pageSize || 25;

        return getmultipleSP('Get_Report_StudentLiveClasses_By_BatchAndStudent', [
            studentId,
            Batch_ID,
            Course_ID,
            Start_Date,
            End_Date,
            page,
            pageSize
        ]);
    },
    Get_Report_Student: async function (
        studentSearch,
        batchSearch,
        courseSearch,
        fromDate,
        toDate,
        page,
        pageSize
    ) {
        studentSearch = studentSearch || '';
        batchSearch = batchSearch || '';
        courseSearch = courseSearch || '';
        fromDate = fromDate || '';
        toDate = toDate || '';
        page = page || 1;
        pageSize = pageSize || 10;

        return getmultipleSP('Get_Report_Student', [
            studentSearch,
            batchSearch,
            courseSearch,
            1,
            fromDate,
            toDate,
            page,
            pageSize
        ]);
    },
    Get_Outstanding_Student: async function (
        studentId,
        Batch_ID,
        Course_ID,
        Start_Date,
        End_Date,
        page,
        pageSize
    ) {
        console.log("11111", studentId,
            Batch_ID,
            Course_ID,
            Start_Date,
            End_Date,
            page,
            pageSize);

        studentId = studentId || 0;
        Batch_ID = Batch_ID || 0;
        Course_ID = Course_ID || 0;
        Start_Date = Start_Date || '';
        End_Date = End_Date || '';
        page = page || 1;
        pageSize = pageSize || 10;

        return getmultipleSP('Get_Outstanding_Student', [
            studentId,
            Batch_ID,
            Course_ID,
            1,
            Start_Date,
            End_Date,
            page,
            pageSize
        ]);
    },
    Get_upcomming_installments: async function (
        studentId,
        Batch_ID,
        Course_ID,
        Start_Date,
        End_Date,
        page,
        pageSize
    ) {
        studentId = studentId || 0;
        Batch_ID = Batch_ID || 0;
        Course_ID = Course_ID || 0;
        Start_Date = Start_Date || '';
        End_Date = End_Date || '';
        page = page || 1;
        pageSize = pageSize || 10;

        return getmultipleSP('Get_upcomming_installments', [
            studentId,
            Batch_ID,
            Course_ID,
            1,
            Start_Date,
            End_Date,
            page,
            pageSize
        ]);
    },
    Get_Due_installments: async function (
        studentId,
        Batch_ID,
        Course_ID,
        Start_Date,
        End_Date,
        page,
        pageSize
    ) {
        studentId = studentId || 0;
        Batch_ID = Batch_ID || 0;
        Course_ID = Course_ID || 0;
        Start_Date = Start_Date || '';
        End_Date = End_Date || '';
        page = page || 1;
        pageSize = pageSize || 10;

        return getmultipleSP('Get_Due_installments', [
            studentId,
            Batch_ID,
            Course_ID,
            Start_Date,
            End_Date,
            pageSize,
            page
        ]);
    },
    Get_Report_TeacherLiveClasses_By_BatchAndTeacher: async function (
        Teacher_ID,
        Batch_ID,
        Course_ID,
        Start_Date,
        End_Date,
        page,
        pageSize
    ) {
        Teacher_ID = Teacher_ID || 0;
        Batch_ID = Batch_ID || 0;
        Course_ID = Course_ID || 0;
        Start_Date = Start_Date || '';
        End_Date = End_Date || '';
        page = page || 1;
        pageSize = pageSize || 25;

        return getmultipleSP('Get_Report_TeacherLiveClasses_By_BatchAndTeacher', [
            Teacher_ID,
            Batch_ID,
            Course_ID,
            Start_Date,
            End_Date,
            page,
            pageSize
        ]);
    },

    Get_Hod_Course: async function (userId) {

        return executeTransaction('Get_Hod_Course', [userId]);
    },
    Get_Report_LiveClasses_By_BatchAndTeacher: async function (Teacher_ID, Batch_ID, Course_ID, Start_Date, End_Date) {
        if (!End_Date) {

            console.log('End_Date: ', End_Date);
            console.log('Start_Date: ', Start_Date);
        } !Teacher_ID ? Teacher_ID = 0 : Teacher_ID;
        !Batch_ID ? Batch_ID = 0 : Batch_ID;
        !Course_ID ? Course_ID = 0 : Course_ID;
        !Start_Date ? Start_Date = '' : Start_Date;
        !End_Date ? End_Date = '' : End_Date;
        console.log('End_Date: ', End_Date);

        return executeTransaction('Get_Report_LiveClasses_By_BatchAndTeacher', [Teacher_ID, Batch_ID, Course_ID, Start_Date, End_Date]);
    },
    Get_Work_Report_Summary: async function ({ fromDate, toDate, useCreatedDate = 0 }) {
        const normalized = normalizeDateBounds(fromDate, toDate);
        const dateColumn = Number(useCreatedDate) ? 'DATE(sf.Created_Date)' : 'DATE(sf.Next_Follow_Up_Date)';

        const sql = `
            SELECT
                u.User_ID,
                TRIM(CONCAT(COALESCE(u.First_Name, ''), ' ', COALESCE(u.Last_Name, ''))) AS Staff_Name,
                COUNT(sf.Follow_Up_ID) AS Follow_Up_Count
            FROM users u
            LEFT JOIN student_followup sf
                ON COALESCE(sf.Created_By, sf.Assigned_Staff_ID) = u.User_ID
                AND IFNULL(sf.Delete_Status, 0) = 0
                AND (? IS NULL OR ${dateColumn} >= ?)
                AND (? IS NULL OR ${dateColumn} <= ?)
            WHERE IFNULL(u.Delete_Status, 0) = 0
            GROUP BY u.User_ID, u.First_Name, u.Last_Name
            ORDER BY Follow_Up_Count DESC, Staff_Name ASC
        `;

        const [rows] = await db.promise().query(sql, [
            normalized.fromDate, normalized.fromDate,
            normalized.toDate, normalized.toDate
        ]);

        return rows;
    },
    Get_Work_Report_Details: async function ({
        staffId,
        fromDate,
        toDate,
        useCreatedDate = 0,
        departmentId,
        searchBy = 'name',
        searchTerm = ''
    }) {
        const normalized = normalizeDateBounds(fromDate, toDate);
        const dateColumn = Number(useCreatedDate) ? 'DATE(sf.Created_Date)' : 'DATE(sf.Next_Follow_Up_Date)';
        const sanitizedSearchBy = String(searchBy || 'name').toLowerCase() === 'mobile' ? 'mobile' : 'name';
        const trimmedSearch = String(searchTerm || '').trim();
        const searchValue = trimmedSearch ? `%${trimmedSearch}%` : null;

        const sql = `
            SELECT
                sf.Follow_Up_ID,
                sf.Student_ID,
                CONCAT(COALESCE(s.First_Name, ''), CASE WHEN COALESCE(s.Last_Name, '') <> '' THEN ' ' ELSE '' END, COALESCE(s.Last_Name, '')) AS Student_Name,
                CONCAT(COALESCE(s.Country_Code, ''), CASE WHEN COALESCE(s.Country_Code, '') <> '' AND COALESCE(s.Phone_Number, '') <> '' THEN ' ' ELSE '' END, COALESCE(s.Phone_Number, '')) AS Mobile,
                sf.Next_Follow_Up_Date,
                sf.Created_Date,
                sf.Department_ID,
                sf.Department_Name,
                sf.Follow_Up_Status_ID,
                sf.Follow_Up_Status_Name,
                COALESCE(sf.Created_By, sf.Assigned_Staff_ID) AS Follow_Up_By_ID,
                TRIM(CONCAT(COALESCE(fu.First_Name, ''), ' ', COALESCE(fu.Last_Name, ''))) AS Follow_Up_By_Name,
                sf.Assigned_Staff_ID,
                sf.Assigned_Staff_Name,
                sf.Remark
            FROM student_followup sf
            INNER JOIN student s ON s.Student_ID = sf.Student_ID
            LEFT JOIN users fu ON fu.User_ID = COALESCE(sf.Created_By, sf.Assigned_Staff_ID)
            WHERE IFNULL(sf.Delete_Status, 0) = 0
                AND IFNULL(s.Delete_Status, 0) = 0
                AND (? IS NULL OR COALESCE(sf.Created_By, sf.Assigned_Staff_ID) = ?)
                AND (? IS NULL OR ${dateColumn} >= ?)
                AND (? IS NULL OR ${dateColumn} <= ?)
                AND (? IS NULL OR ? = 0 OR sf.Department_ID = ?)
                AND (
                    ? IS NULL
                    OR (
                        ? = 'mobile'
                        AND (
                            s.Phone_Number LIKE ?
                            OR CONCAT(COALESCE(s.Country_Code, ''), ' ', COALESCE(s.Phone_Number, '')) LIKE ?
                        )
                    )
                    OR (
                        ? <> 'mobile'
                        AND (
                            CONCAT(COALESCE(s.First_Name, ''), ' ', COALESCE(s.Last_Name, '')) LIKE ?
                            OR s.First_Name LIKE ?
                            OR s.Last_Name LIKE ?
                        )
                    )
                )
            ORDER BY COALESCE(sf.Created_Date, sf.Next_Follow_Up_Date) DESC, sf.Follow_Up_ID DESC
        `;

        const [rows] = await db.promise().query(sql, [
            staffId || null, staffId || null,
            normalized.fromDate, normalized.fromDate,
            normalized.toDate, normalized.toDate,
            departmentId || null, departmentId || 0, departmentId || null,
            searchValue,
            sanitizedSearchBy, searchValue, searchValue,
            sanitizedSearchBy, searchValue, searchValue, searchValue
        ]);

        return rows;
    },
    Get_User_Email_Number: async function (user_Id) {
        return executeTransaction('Get_User_Email_Number', [
            user_Id
        ]);

    },
    Check_Call_Availability: async function (user_Id, is_Student) {
        return executeTransaction('Check_Call_Availability', [
            user_Id, is_Student
        ]);

    },

    update_user_status: async function (user_Id, status) {
        status = status == 'true' ? 1 : 0
        return executeTransaction('update_user_status', [
            user_Id, status
        ]);

    },
    Search_User_Invoice: async function (user_Id) {
        return executeTransaction('Search_User_Invoice', [
            user_Id
        ]);

    },
    Delete_Invoice: async function (Invoice_Id) {
        return executeTransaction('Delete_Invoice', [
            Invoice_Id
        ]);

    },
    Save_User_Invoice: async function (data) {
        return executeTransaction('Save_User_Invoice', [
            data.Invoice_Id,
            data.invoice_date,
            data.name,
            data.position,
            data.course_name,
            data.payment_period,
            data.class_hours,
            data.total_amount,
            data.approved_by,
            data.user_Id,
            data.Course_Id
        ]);
    },
    get_onetoone_Recordings: async function (studentId) {
        return executeTransaction('Get_OneToOne_Recordings', [studentId]);
    },
    Report_User: async function (reportData) {
        return executeTransaction('Report_User', [
            reportData.reporter_id,
            reportData.reported_user_id,
            reportData.chat_id || null,  // Optional chat message reporting
            reportData.report_reason
        ]);
    },
    Get_Blocked_User: async function (user_id) {
        return executeTransaction('Get_Blocked_User', [user_id]);
    },
    Block_User: async function (blockData) {
        return executeTransaction('Block_User', [
            blockData.blocker_id,
            blockData.blocked_user_id,
            blockData.Is_Student_Blocked
        ]);
    },
    Unblock_User: async function (blockData) {
        return executeTransaction('Unblock_User', [
            blockData.blocker_id,
            blockData.blocked_user_id
        ]);
    },
    Check_User_Blocked_Status: async function (blocker_id, blocked_user_id) {
        return executeTransaction('Check_User_Blocked_Status', [
            blocker_id,
            blocked_user_id
        ]);
    },
    Get_Enquiry_Conversion_Summary: async function ({ fromDate, toDate }) {
        return getmultipleSP('Get_Enquiry_Conversion_Summary', [
            fromDate || '',
            toDate || ''
        ]);
    },
    Get_Enquiry_Conversion_Details: async function ({ sourceId, fromDate, toDate }) {
        return getmultipleSP('Get_Enquiry_Conversion_Details', [
            sourceId,
            fromDate || '',
            toDate || ''
        ]);
    },
    Get_My_Students_Report: async function (
        studentSearch,
        batchSearch,
        courseSearch,
        fromDate,
        toDate,
        page,
        pageSize,
        staffId
    ) {
        studentSearch = studentSearch || '';
        batchSearch = batchSearch || '';
        courseSearch = courseSearch || '';
        fromDate = fromDate || null;
        toDate = toDate || null;
        page = page || 1;
        pageSize = pageSize || 12;
        const offset = (page - 1) * pageSize;

        // Fetch user info to determine filtering logic
        let isSuperAdmin = false;
        if (staffId) {
            const [userRows] = await db.promise().query(
                'SELECT User_ID, User_Type_Id, Email FROM users WHERE User_ID = ?', 
                [staffId]
            );
            const userObj = userRows?.[0];
            if (userObj && (userObj.User_ID === 1 || userObj.User_Type_Id === 1 || userObj.Email === 'admin_user@G.COM' || userObj.Email === 'cs.mgr@testprepinenglish.com')) {
                isSuperAdmin = true;
            }
        } else {
            isSuperAdmin = true;
        }

        let staffFilter = '';
        let staffParams = [];

        // Apply restriction for non-superadmin users (including trainers and team leads with assigned staff)
        if (!isSuperAdmin && staffId) {
            const [hierarchyRows] = await db.promise().query(`
                WITH RECURSIVE staff_hierarchy AS (
                    SELECT ? as staff_id
                    UNION ALL
                    SELECT sta.staff_user_id as staff_id
                    FROM staff_team_assignment sta
                    INNER JOIN staff_hierarchy sh ON sta.team_lead_user_id = sh.staff_id
                    WHERE sta.staff_user_id <> 1
                )
                SELECT DISTINCT staff_id FROM staff_hierarchy;
            `, [staffId]);

            const allowedStaffIds = hierarchyRows.map(r => r.staff_id);
            if (!allowedStaffIds.includes(staffId)) {
                allowedStaffIds.push(staffId);
            }

            const placeholders = allowedStaffIds.map(() => '?').join(',');

            staffFilter = `
              AND (
                  s.To_User_Id IN (${placeholders})
                  OR COALESCE(NULLIF(sc.Slot_Id, 0), sc.Requested_Slot_Id) IN (
                      SELECT tts.Slot_Id 
                      FROM teacher_time_slot tts 
                      JOIN course_teacher ct ON tts.CourseTeacher_ID = ct.CourseTeacher_ID 
                      WHERE ct.Teacher_ID IN (${placeholders}) 
                        AND IFNULL(tts.Delete_Status, 0) = 0 
                        AND IFNULL(ct.Delete_Status, 0) = 0
                  )
              )
            `;
            staffParams = [
                ...allowedStaffIds,
                ...allowedStaffIds
            ];
        }

        const baseQuery = `
            FROM student s
            INNER JOIN student_course sc ON s.Student_ID = sc.Student_ID
            LEFT JOIN course_batch cb ON sc.Batch_ID = cb.Batch_ID
            LEFT JOIN course c ON sc.Course_ID = c.Course_ID
            WHERE s.Delete_Status = 0
              AND IFNULL(sc.Delete_Status, 0) = 0
              ${staffFilter}
              AND (? = '' OR s.First_Name LIKE CONCAT('%', ?, '%') OR s.Last_Name LIKE CONCAT('%', ?, '%') OR s.Email LIKE CONCAT('%', ?, '%') OR s.Phone_Number LIKE CONCAT('%', ?, '%'))
              AND (? = '' OR cb.Batch_Name LIKE CONCAT('%', ?, '%'))
              AND (? = '' OR c.Course_Name LIKE CONCAT('%', ?, '%'))
              AND (? IS NULL OR ? = '' OR DATE(s.Entry_Date) >= ?)
              AND (? IS NULL OR ? = '' OR DATE(s.Entry_Date) <= ?)
        `;

        const params = [
            ...staffParams,
            studentSearch, studentSearch, studentSearch, studentSearch, studentSearch,
            batchSearch, batchSearch,
            courseSearch, courseSearch,
            fromDate, fromDate, fromDate,
            toDate, toDate, toDate
        ];

        const countSql = `SELECT COUNT(DISTINCT s.Student_ID) AS totalRecords ${baseQuery}`;
        const dataSql = `SELECT s.*, sc.Course_ID, sc.Batch_ID, cb.Batch_Name, c.Course_Name ${baseQuery} GROUP BY s.Student_ID ORDER BY s.Entry_Date DESC LIMIT ? OFFSET ?`;

        const [countResult] = await db.promise().query(countSql, params);
        const [data] = await db.promise().query(dataSql, [...params, pageSize, offset]);

        return [countResult, data];
    },
    // get_chat_call_history: async function (student_Id_,teacher_Id_) {
    //     return executeTransaction('get_chat_call_history', [student_Id_,teacher_Id_]);
    // },
    Check_Uniqueness: async function (data) {
        const { Email, PhoneNumber, User_ID } = data;
        let sql = `SELECT 
                    (SELECT COUNT(*) FROM users WHERE Email = ? AND User_ID <> ? AND IFNULL(Delete_Status, 0) = 0) as emailCount,
                    (SELECT COUNT(*) FROM users WHERE PhoneNumber = ? AND User_ID <> ? AND IFNULL(Delete_Status, 0) = 0) as phoneCount`;
        const [rows] = await db.promise().query(sql, [Email || '', User_ID || 0, PhoneNumber || '', User_ID || 0]);
        return rows[0];
    },
};
module.exports = user;
