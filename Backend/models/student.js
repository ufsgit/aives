var fs = require("fs");
const { executeTransaction, getmultipleSP } = require("../helpers/sp-caller");
const db = require("../config/dbconnection");

async function getLatestAssignedStaff(studentId) {
  if (!studentId) {
    return { Assigned_Staff_ID: null, Assigned_Staff_Name: "" };
  }

  const sql = `
    SELECT
      COALESCE(sf.Assigned_Staff_ID, s.To_User_Id) AS Assigned_Staff_ID,
      COALESCE(NULLIF(sf.Assigned_Staff_Name, ''), NULLIF(s.To_User_Name, ''), '') AS Assigned_Staff_Name
    FROM student s
    LEFT JOIN student_followup sf
      ON sf.Follow_Up_ID = (
        SELECT sf2.Follow_Up_ID
        FROM student_followup sf2
        WHERE sf2.Student_ID = s.Student_ID
          AND IFNULL(sf2.Delete_Status, 0) = 0
        ORDER BY COALESCE(sf2.Updated_Date, sf2.Created_Date) DESC, sf2.Follow_Up_ID DESC
        LIMIT 1
      )
    WHERE s.Student_ID = ?
    LIMIT 1
  `;

  const [rows] = await db.promise().query(sql, [studentId]);
  return rows[0] || { Assigned_Staff_ID: null, Assigned_Staff_Name: "" };
}

async function enrichLeadRowsWithAssignedStaff(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return rows;
  }

  const studentIds = rows
    .map((row) => row?.Student_ID)
    .filter((id) => Number.isInteger(Number(id)))
    .map((id) => Number(id));

  if (!studentIds.length) {
    return rows;
  }

  const placeholders = studentIds.map(() => "?").join(",");
  const sql = `
    SELECT
      s.Student_ID,
      COALESCE(sf.Assigned_Staff_ID, s.To_User_Id) AS Assigned_Staff_ID,
      COALESCE(NULLIF(sf.Assigned_Staff_Name, ''), NULLIF(s.To_User_Name, ''), '') AS Assigned_Staff_Name
    FROM student s
    LEFT JOIN student_followup sf
      ON sf.Follow_Up_ID = (
        SELECT sf2.Follow_Up_ID
        FROM student_followup sf2
        WHERE sf2.Student_ID = s.Student_ID
          AND IFNULL(sf2.Delete_Status, 0) = 0
        ORDER BY COALESCE(sf2.Updated_Date, sf2.Created_Date) DESC, sf2.Follow_Up_ID DESC
        LIMIT 1
      )
    WHERE s.Student_ID IN (${placeholders})
  `;

  const [staffRows] = await db.promise().query(sql, studentIds);
  const staffByStudentId = new Map(
    staffRows.map((row) => [Number(row.Student_ID), row])
  );

  return rows.map((row) => {
    const latestStaff = staffByStudentId.get(Number(row.Student_ID));
    if (!latestStaff) {
      return row;
    }

    return {
      ...row,
      Assigned_Staff_ID:
        latestStaff.Assigned_Staff_ID ?? row.Assigned_Staff_ID ?? null,
      Assigned_Staff_Name:
        latestStaff.Assigned_Staff_Name || row.Assigned_Staff_Name || "",
    };
  });
}

async function enrichLeadRowsWithResponses(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return rows;
  }

  const studentIds = rows
    .map((row) => row?.Student_ID)
    .filter((id) => Number.isInteger(Number(id)))
    .map((id) => Number(id));

  const emails = rows
    .map((row) => (row?.Email || '').trim().toLowerCase())
    .filter((email) => email.length > 0);

  let responseRows = [];
  try {
    if (studentIds.length > 0) {
      const placeholders = studentIds.map(() => "?").join(",");
      const sql = `
        SELECT lr.*
        FROM lead_response lr
        INNER JOIN (
          SELECT Student_ID, MAX(Response_ID) as max_id
          FROM lead_response
          WHERE Student_ID IN (${placeholders}) AND (Delete_Status = 0 OR Delete_Status IS NULL)
          GROUP BY Student_ID
        ) latest ON lr.Response_ID = latest.max_id
      `;
      const [res] = await db.promise().query(sql, studentIds);
      responseRows = res;
    }

    // Also match by email if any lead doesn't match by ID
    const matchedStudentIds = new Set(responseRows.map(r => Number(r.Student_ID)));
    const missingEmails = rows
      .filter(r => !matchedStudentIds.has(Number(r.Student_ID)) && (r.Email || '').trim())
      .map(r => (r.Email || '').trim().toLowerCase());

    if (missingEmails.length > 0) {
      const emailPlaceholders = missingEmails.map(() => "?").join(",");
      const emailSql = `
        SELECT lr.*
        FROM lead_response lr
        INNER JOIN (
          SELECT LOWER(TRIM(Email)) as clean_email, MAX(Response_ID) as max_id
          FROM lead_response
          WHERE LOWER(TRIM(Email)) IN (${emailPlaceholders}) AND (Delete_Status = 0 OR Delete_Status IS NULL)
          GROUP BY LOWER(TRIM(Email))
        ) latest ON lr.Response_ID = latest.max_id
      `;
      const [emailRes] = await db.promise().query(emailSql, missingEmails);
      responseRows = responseRows.concat(emailRes);
    }
  } catch (err) {
    console.error('Error enriching lead rows with responses:', err.message);
  }

  const responsesByStudentId = new Map();
  const responsesByEmail = new Map();

  for (const resp of responseRows) {
    if (resp.Student_ID) {
      responsesByStudentId.set(Number(resp.Student_ID), resp);
    }
    if (resp.Email) {
      responsesByEmail.set(resp.Email.trim().toLowerCase(), resp);
    }
  }

  return rows.map((row) => {
    const studentId = Number(row.Student_ID);
    const email = (row.Email || '').trim().toLowerCase();
    const resp = responsesByStudentId.get(studentId) || (email ? responsesByEmail.get(email) : null);

    if (resp) {
      const rawChoice = resp.Response_Choice || resp.Interested_Course || '';
      const isNotInterested = rawChoice.toLowerCase().includes('not');
      const isInterested = rawChoice.toLowerCase().includes('interest') && !isNotInterested;
      const statusText = isNotInterested ? 'Not Interested' : (isInterested ? 'Interested' : (rawChoice || 'Responded'));

      return {
        ...row,
        Has_Responded: true,
        Response_Status: statusText,
        Response_Choice: statusText,
        Lead_Response: resp,
        Interested_Course: resp.Interested_Course || row.Interested_Course || null
      };
    }

    return {
      ...row,
      Has_Responded: false,
      Response_Status: 'Pending',
      Lead_Response: null
    };
  });
}

var student = {
  Registration_Using_Student_Branch: async function (student) {
    console.log("student: ", student);
    return executeTransaction("Registration_Using_Student_Branch", [
      student.Student_ID,
      student.Is_Registered,
      student.User_ID,
    ]);
  },
  Remove_Student_Registration: async function (student) {
    console.log("student: ", student);
    return executeTransaction("Remove_Student_Registration", [
      student.Student_ID,
      // student.Is_Registered,
      0,
      student.User_ID,
    ]);
  },
  Check_Uniqueness: async function (data) {
    const { Email, Phone_Number, Student_ID } = data;
    let sql = `SELECT 
                (SELECT COUNT(*) FROM student WHERE Email = ? AND Student_ID <> ? AND IFNULL(Delete_Status, 0) = 0) as emailCount,
                (SELECT COUNT(*) FROM student WHERE Phone_Number = ? AND Student_ID <> ? AND IFNULL(Delete_Status, 0) = 0) as phoneCount`;
    const [rows] = await db.promise().query(sql, [Email || '', Student_ID || 0, Phone_Number || '', Student_ID || 0]);
    return rows[0];
  },
  Save_student: async function (student) {
   
    student.Student_Fees_IDs = JSON.stringify(student.Student_Fees_IDs);
    if (student.Installments && student.Installments.length > 0) {
      student.Installments = JSON.stringify(student.Installments);
    } else {
      student.Installments = null;
    }
    // console.log("student: ", student.Installments);
    // Convert JS Date -> YYYY-MM-DD format
    if (student.Admission_Date) {
      student.Admission_Date = new Date(student.Admission_Date)
        .toISOString()
        .slice(0, 10);
    }

    if (student.Follow_Up_Date) {
      student.Follow_Up_Date = new Date(student.Follow_Up_Date)
        .toISOString()
        .slice(0, 10);
    }

    if (student.Next_Follow_Up_Date) {
      student.Next_Follow_Up_Date = new Date(student.Next_Follow_Up_Date)
        .toISOString()
        .slice(0, 10);
    }

    // Convert Registered_On from ISO string to MySQL DATETIME format
    if (student.Registered_On) {
      student.Registered_On = new Date(student.Registered_On)
          .toISOString()
          .slice(0, 19)       // "2026-02-12T08:39:17"
          .replace('T', ' '); // "2026-02-12 08:39:17"
    }

 const toInt = (val) => {
    if (val === '' || val == null) return null;
    const parsed = parseInt(val);
    return isNaN(parsed) ? null : parsed;
};
    const toStr = (val) => (val !== '' && val != null ? String(val) : '');

    const Branch_Id_=student.Branch_Id !== '' && student.Branch_Id != null
  ? parseInt(student.Branch_Id)
  : null

    const hasAssignedStaffId =
      student.Assigned_Staff_ID !== "" &&
      student.Assigned_Staff_ID != null &&
      !Number.isNaN(parseInt(student.Assigned_Staff_ID));
    const hasAssignedStaffName =
      student.Assigned_Staff_Name !== "" && student.Assigned_Staff_Name != null;

    if (student.Student_ID > 0 && (!hasAssignedStaffId || !hasAssignedStaffName)) {
      const existingAssignedStaff = await getLatestAssignedStaff(student.Student_ID);

      if (!hasAssignedStaffId) {
        student.Assigned_Staff_ID = existingAssignedStaff.Assigned_Staff_ID;
      }

      if (!hasAssignedStaffName) {
        student.Assigned_Staff_Name = existingAssignedStaff.Assigned_Staff_Name;
      }
    }


    const args = [
    student.Student_ID,
    student.First_Name,
    student.Last_Name,
    student.Email,
    student.Phone_Number,
    student.Social_Provider,
    student.Social_ID,
    student.Delete_Status || 0,
    student.Profile_Photo_Name,
    student.Profile_Photo_Path,
    student.Avatar,
    student.Country_Code,
    student.Country_Code_Name,
    toInt(student.Roll_No),
    student.Branch_Name,
    Branch_Id_,
    student.Follow_Up_Date || student.Next_Follow_Up_Date || null,
    student.Admission_Date || null,
    toInt(student.Follow_Up_Status_ID),       
    student.Follow_Up_Status_Name || "",
    toInt(student.Assigned_Staff_ID),         
    student.Assigned_Staff_Name || "",
    toInt(student.Created_By),                
    student.Remark || "",
    student.Followup_Status || false,
    toInt(student.Department_Id),             
    student.Department_Name || "",
    toInt(student.Age),                       
    student.Qualification || "",
    student.Qualification_Description || "",
    student.Alt_Phone_Number || "",
    student.Address || "",
    student.Guardian_Type || "",
    student.Guardian_Name || "",
    student.Guardian_Phone || "",
    student.Guardian_Alt_Phone || "",
    toInt(student.Height_cm),                 
    toInt(student.Weight_kg),                 
    student.Active_Status,
    toInt(student.Enquiry_Source_Id) ?? 0,    
    toInt(student.Created_By),
    student.Installments || null,
    student.Student_Fees_IDs || null,
    student.isRegistering ? 1 : 0,
    toInt(student.Registered_By),
    student.Registered_On || null,
    student.Mock_Test_Subscribed ? 1 : 0,
    student.Mock_Test_Package || null,
    student.Priority || "Medium"
    ].map(arg => Number.isNaN(arg) ? null : arg);

    return executeTransaction("Save_student", args);
  },
  Save_User_Permission: async function (payload) {
    
      const jsonPayload = JSON.stringify(payload);
      // console.log("payload",jsonPayload);
    return executeTransaction("Save_User_Permission", [jsonPayload
    ]);
  
  },
  Save_student_followup: async function (followup) {
    const args = [
      followup.Follow_Up_ID,
      followup.Student_ID,
      followup.Branch_ID,
      followup.Branch_Name,
      followup.Department_ID,
      followup.Department_Name,
      followup.Assigned_Staff_ID,
      followup.Assigned_Staff_Name,
      followup.Follow_Up_Status_ID,
      followup.Follow_Up_Status_Name,
      followup.Next_Follow_Up_Date,
      followup.Remark,
      followup.Created_Date,
      followup.Created_By,
      followup.Delete_Status,
    ].map(arg => Number.isNaN(arg) ? null : arg);
    
    return executeTransaction("Save_student_followup", args);
  },
  Get_Unassigned_Excel_Leads: async function () {
    const [rows] = await db.promise().query(
      `SELECT Student_ID, First_Name as Name, Phone_Number, Email, Entry_Date 
       FROM student 
       WHERE Delete_Status = 0 
         AND Enquiry_Source_Id = 3 
         AND (To_User_Id IS NULL OR To_User_Id = 0)
       ORDER BY Student_ID DESC`
    );
    return rows;
  },
  Take_Excel_Lead: async function (studentId, staffId, staffName) {
    const [result] = await db.promise().query(
      `UPDATE student 
       SET To_User_Id = ?, To_User_Name = ? 
       WHERE Student_ID = ?`,
      [staffId, staffName, studentId]
    );
    return result;
  },
  Get_student: async function (student_Id_, is_Student) {
    return getmultipleSP("Get_student", [
      student_Id_,
      is_Student ? is_Student : 0,
    ]);
  },
  // In your model file (e.g., student.js)

  Search_student: async function (
    student_Name_,
    page,
    pageSize,
    course_Id,
    Batch_ID,
    enrollment_status = "all",
    activeStatus,
    filter_subscribed = "all",
    filter_roll_number = "",
    p_user_id = null,
    p_user_type_id = null
  ) {
    const toIntOrNull = (val) => {
      if (val === undefined || val === "undefined" || val === null || val === "")
        return null;
      return parseInt(val);
    };

    activeStatus =
      !activeStatus || activeStatus === "undefined" ? "all" : activeStatus;

    if (student_Name_ === undefined || student_Name_ === "undefined")
      student_Name_ = "";

    return getmultipleSP("Search_student", [
      student_Name_,
      toIntOrNull(page) || 1,
      toIntOrNull(pageSize) || 10,
      toIntOrNull(course_Id),
      toIntOrNull(Batch_ID),
      enrollment_status || "all",
      activeStatus,
      filter_subscribed,
      filter_roll_number || "",
      toIntOrNull(p_user_id),
      toIntOrNull(p_user_type_id)
    ]);
  },
  Search_student_lead: async function (
    student_Name_,
    page,
    pageSize,
    course_Id,
    Batch_ID,
    enrollment_status = "all",
    activeStatus,
    branchId,
    assignedStaffId,
    enquirySourceId,
    p_user_id,
    p_user_type_id,
    priority = "All"
  ) {
    const toIntOrNull = (val) => {
      if (val === undefined || val === "undefined" || val === null || val === "")
        return null;
      return parseInt(val);
    };

    activeStatus =
      !activeStatus || activeStatus === "undefined" ? "all" : activeStatus;
    console.log("activeStatus: ", activeStatus);
    if (student_Name_ === undefined || student_Name_ === "undefined")
      student_Name_ = "";

    const results = await getmultipleSP("Search_student_lead", [
      student_Name_,
      toIntOrNull(page) || 1,
      toIntOrNull(pageSize) || 10,
      toIntOrNull(course_Id),
      toIntOrNull(Batch_ID),
      enrollment_status || "all",
      activeStatus,
      toIntOrNull(branchId),
      toIntOrNull(assignedStaffId),
      toIntOrNull(enquirySourceId),
      toIntOrNull(p_user_id),
      toIntOrNull(p_user_type_id),
      priority || "All"
    ]);

    if (Array.isArray(results) && Array.isArray(results[1])) {
      results[1] = await enrichLeadRowsWithAssignedStaff(results[1]);
      results[1] = await enrichLeadRowsWithResponses(results[1]);
    }

    return results;
  },
  Get_Lead_Response: async function (studentId) {
    const [rows] = await db.promise().query(
      `SELECT * FROM lead_response 
       WHERE Student_ID = ? AND (Delete_Status = 0 OR Delete_Status IS NULL) 
       ORDER BY Submitted_At DESC LIMIT 1`,
      [studentId]
    );
    return rows[0] || null;
  },
  Get_Registration_Report: async function (
    student_Name_,
    page,
    pageSize,
    course_Id,
    Batch_ID,
    enrollment_status,
    activeStatus,
    fromDate,
    toDate,
    enrolledById
  ) {
    const toIntOrNull = (val) => {
      if (val === undefined || val === "undefined" || val === null || val === "")
        return null;
      return parseInt(val);
    };

    activeStatus =
      !activeStatus || activeStatus === "undefined" ? "all" : activeStatus;

    if (student_Name_ === undefined || student_Name_ === "undefined")
      student_Name_ = "";
      
    if (fromDate === undefined || fromDate === "undefined" || fromDate === "")
      fromDate = null;
      
    if (toDate === undefined || toDate === "undefined" || toDate === "")
      toDate = null;

    const results = await getmultipleSP("Get_Registration_Report", [
      student_Name_,
      toIntOrNull(page) || 1,
      toIntOrNull(pageSize) || 10,
      toIntOrNull(course_Id),
      toIntOrNull(Batch_ID),
      enrollment_status || "all",
      activeStatus,
      fromDate,
      toDate,
      toIntOrNull(enrolledById),
    ]);

    return results;
  },
  Get_Registration_Summary: async function (fromDate, toDate) {
    if (fromDate === undefined || fromDate === "undefined" || fromDate === "")
      fromDate = null;
    if (toDate === undefined || toDate === "undefined" || toDate === "")
      toDate = null;
    
    return getmultipleSP("Get_Registration_Summary", [fromDate, toDate]);
  },
  Get_All_Students: async function (student_Name_) {
    if (student_Name_ === undefined || student_Name_ === "undefined")
      student_Name_ = "";
    return executeTransaction("Get_All_Students", [student_Name_]);
  },
  Get_All_Enquiry: async function () {
    return executeTransaction("Get_All_Enquiry", []);
  },
  Get_student_followup_history: async function (student_Id_) {
    console.log("student_Id_: ", student_Id_);
    return getmultipleSP("Get_student_followup_history", [student_Id_]);
  },
  Get_student_current_followup: async function (student_Id_) {
    console.log("student_Id_: ", student_Id_);
    return getmultipleSP("Get_student_current_followup", [student_Id_]);
  },
  Get_Courses_By_StudentId: async function (
    student_Id_,
    course_Name_,
    priceFrom,
    priceTo
  ) {
    console.log("course_Name_: ", course_Name_);

    !course_Name_ ? (course_Name_ = "") : course_Name_;
    !priceTo ? (priceTo = 0) : priceTo;
    !priceFrom ? (priceFrom = 0) : priceFrom;
    console.log("priceTo: ", priceTo);
    console.log("priceFrom: ", priceFrom);
    return executeTransaction("Get_Courses_By_StudentId", [
      student_Id_,
      course_Name_,
      priceFrom,
      priceTo,
    ]);
  },
  GetAllCourses: async function (
    course_Type_,
    student_ID_,
    priceFrom,
    priceTo
  ) {
    !priceTo ? (priceTo = 0) : priceTo;
    !priceFrom ? (priceFrom = 0) : priceFrom;
    return executeTransaction("Search_course", [
      "",
      course_Type_,
      student_ID_,
      priceFrom,
      priceTo,
    ]);
  },
  Search_Occupations: async function () {
    return executeTransaction("Search_Occupations", []);
  },
  Branch_Dropdown: async function () {
    return executeTransaction("Branch_Dropdown", []);
  },
  User_Dropdown: async function () {
    return executeTransaction("User_Dropdown", []);
  },
  Followup_status_Dropdown: async function () {
    return executeTransaction("Followup_status_Dropdown", []);
  },
  Department_Dropdown: async function () {
    return executeTransaction("Department_Dropdown", []);
  },
  Course_Dropdown: async function () {
    return executeTransaction("Course_Dropdown", []);
  },
  course_batch_Dropdown: async function () {
    return executeTransaction("course_batch_Dropdown", []);
  },
  Save_Followup_Status: async function (data) {
    return executeTransaction("Save_Followup_Status", [
      data.Status_Id || 0,
      data.Status_Name,
      data.Status_Color || '#6B7280',
      data.Description || '',
      data.Display_Order || 0,
      data.Is_Active !== undefined ? data.Is_Active : 1
    ]);
  },
  Get_Followup_Status: async function () {
    return getmultipleSP("Get_Followup_Status", []);
  },
  Delete_Followup_Status: async function (id) {
    return executeTransaction("Delete_Followup_Status", [id]);
  },
  Save_Enquiry_Source: async function(data) {
    return executeTransaction('Save_Enquiry_Source', [
      data.Enquiry_Source_Id || 0,
      data.Enquiry_Source_Name
    ]);
  },
  Delete_Enquiry_Source: async function(id) {
    return executeTransaction('Delete_Enquiry_Source', [id]);
  },
  Delete_Student_Account: async function (userId) {
    return executeTransaction("Delete_Student_Account", [userId]);
  },
  Get_Courses_By_Category: async function (category_Id_) {
    return executeTransaction("Get_Courses_By_Category", [category_Id_]);
  },
  Get_StudentDocuments: async function (studentId) {
    return executeTransaction("Get_StudentDocuments", [studentId]);
  },
  GetEnrolledCourses: async function (student_Id_) {
    return executeTransaction("GetCoursesByStudentId", [student_Id_]);
  },
  CheckStudentEnrollment: async function (student_Id_, course_Id_) {
    return executeTransaction("CheckStudentEnrollment", [
      student_Id_,
      course_Id_,
    ]);
  },
  enroleCourse: async function (course) {
    const args = [
      course.Student_ID,
      course.Course_ID,
      course.Enrollment_Date,
      course.Price,
      course.Payment_Date,
      course.Payment_Status,
      course.LastAccessed_Content_ID,
      course.Transaction_Id,
      course.Delete_Status,
      course.Payment_Method,
      course.Slot_Id,
      course.Batch_ID,
      course.StudentCourse_ID,
    ].map(arg => Number.isNaN(arg) ? null : arg);
    return executeTransaction("enroleCourse", args);
  },
enroleCourseFromAdmin: async function (course) {
    console.log(course);

    // Helper to convert empty string/invalid values to null for numeric fields
    const toInt = (val) => {
        if (val === '' || val == null) return null;
        const parsed = parseInt(val, 10);
        return isNaN(parsed) ? null : parsed;
    };
    const toDecimal = (val) => {
        if (val === '' || val == null) return null;
        const parsed = parseFloat(val);
        return isNaN(parsed) ? null : parsed;
    };
    const toStr = (val) => (val !== '' && val != null ? val : null);

    // Format Payment_Date: "2026-02-12T08:30" → "2026-02-12 08:30:00"
    const formatDatetime = (val) => {
        if (!val || val === '') return null;
        return new Date(val).toISOString().slice(0, 19).replace('T', ' ');
    };

    const args = [
        toInt(course.Student_ID),
        toInt(course.Course_ID),               // Was '' → now null
        toStr(course.Enrollment_Date) || null,
        toDecimal(course.Price),               // Was '' → now null
        formatDatetime(course.Payment_Date),   // Was ISO string → now MySQL datetime
        toStr(course.Payment_Status),
        toStr(course.LastAccessed_Content_ID),
        toStr(course.Transaction_Id),
        toInt(course.Delete_Status) ?? 0,
        toStr(course.Payment_Method),
        toInt(course.Slot_Id),
        toInt(course.Batch_ID),
        toInt(course.StudentCourse_ID) ?? 0,
        toStr(course.Installment_information_ID),
        toDecimal(course.Total_FeeAmount) ?? 0,
        toStr(course.Fee_Status),
        toDecimal(course.Discount) ?? 0,
        toDecimal(course.Fee_Amount) ?? 0,
    ].map(arg => Number.isNaN(arg) ? null : arg);

    return executeTransaction("enroleCourseFromAdmin", args);
},
  Buy_Course: async function (course) {
    return executeTransaction("Buy_Course", [course.requestId]);
  },
  Save_chat_message: async function (chat) {
    return executeTransaction("Save_chat_message", [
      chat.Student_ID,
      chat.Chat_Message,
      chat.IsReply,
      chat.Chat_DateTime,
      chat.Delete_Status,
    ]);
  },
  Save_Occupation: async function (data) {
    return executeTransaction("Save_Occupation", [
      data.Student_ID,
      data.Occupation_Id,
      JSON.stringify(data["Prefferd_Course"]),
    ]);
  },
  Bulk_Student_Import: async function (data) {
    return executeTransaction("Bulk_Student_Import", [data]);
  },
  BulkImportInstallmentsBatch: async function (data) {
    function toMySQLDate(dateStr) {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().split("T")[0]; // YYYY-MM-DD
    }

    const cleanedData = data.map((student) => ({
      ...student,
      Due_Date: toMySQLDate(student.Due_Date),
      Admission_Date: toMySQLDate(student.Admission_Date),
      Installments: student.Installments.map((inst) => ({
        ...inst,
        DueDate: toMySQLDate(inst.DueDate),
      })),
    }));

    const jsonPayload = JSON.stringify(cleanedData);
    console.log("jsonPayload", jsonPayload);

    return executeTransaction("Bulk_Student_Import", [jsonPayload]);
  },
  saveAllEnrollments: async function (data) {
    console.log("data: ", data);

    return executeTransaction("saveAllEnrollments", [data]);
  },
  save_DocumentMetadata: async function (data) {
    console.log("data: ", data);

    // Deconstruct values in order expected by SP
    const {
      Document_ID = 0,
      Student_ID,
      Document_Type_Id,
      Document_Name,
      Document_URL,
      S3_Key,
      fileName,
    } = data;

    const params = [
      Document_ID,
      Student_ID,
      Document_Type_Id,
      Document_Name,
      S3_Key,
      Document_URL,
      fileName,
    ];

    return executeTransaction("Save_Document", params);
  },
  Insert_Student_Exam_Result: async function (exam) {
    console.log("exam: ", exam);
    return executeTransaction("Insert_Student_Exam_Result", [
      exam.StudentExam_ID,
      exam.Exam_ID,
      exam.Batch_Id,
      exam.Course_Id,
      exam.Student_ID,
      exam.Listening,
      exam.Reading,
      exam.Writing,
      exam.Speaking,
      exam.Overall_Score,
      exam.CEFR_level,
      exam.Result_Date,
      exam.Exam_Name,
    ]);
  },

  Update_Student_LastOnline: async function (userId, Last_Online) {
    return executeTransaction("Update_Student_LastOnline", [
      userId,
      Last_Online,
    ]);
  },
  Get_Chat_With_Bot: async function (student_Id_) {
    return executeTransaction("Get_Chat_With_Bot", [student_Id_]);
  },
  get_student_fees_details: async function (student_Id_) {
    return executeTransaction("get_student_fees_details", [student_Id_]);
  },
  delete_Student_Exam_result: async function (StudentExam_ID) {
    return executeTransaction("delete_Student_Exam_result", [StudentExam_ID]);
  },
  Delete_StudentDocument: async function (documentId) {
    return executeTransaction("Delete_StudentDocument", [documentId]);
  },
  Get_Live_Classes_By_CourseId: async function (course_Id_, userId, Batch_Id_) {
    return executeTransaction("Get_Live_Classes_By_CourseId", [
      course_Id_,
      userId,
      Batch_Id_,
    ]);
  },
  Get_Recorded_LiveClasses: async function (userId, course_Id) {
    return executeTransaction("Get_Recorded_LiveClasses", [userId, course_Id]);
  },

  Get_Student_Exam_Results: async function (studentId, course_Id) {
    return executeTransaction("Get_Student_Exam_Results", [
      studentId,
      course_Id,
    ]);
  },
  Get_DocumentTypes: async function () {
    return executeTransaction("Get_DocumentTypes", []);
  },

  Get_Dashboard_Data_By_StudentId: async function (student_Id_) {
    return getmultipleSP("Get_Dashboard_Data_By_StudentId", [student_Id_]);
  },
  Get_Available_Mentors: async function (student_Id_) {
    console.log("student_Id_: ", student_Id_);
    return getmultipleSP("Get_Available_Mentors", [student_Id_]);
  },
  Get_Available_Hod: async function (student_Id_) {
    console.log("student_Id_: ", student_Id_);
    return getmultipleSP("Get_Available_Hod", [student_Id_]);
  },
  Generate_certificate: async function (StudentCourse_ID, value) {
    console.log("StudentCourse_ID: ", StudentCourse_ID);
    return getmultipleSP("Generate_certificate", [StudentCourse_ID, value]);
  },
  // Get_ExamDetails_By_StudentId: async function (student_Id_,exam_Id_) {
  //     return executeTransaction('Get_ExamDetails_By_StudentId', [student_Id_,exam_Id_]);
  // }

  Save_AppInfo: async function (appInfo) {
    return executeTransaction("Save_AppInfo", [
      appInfo.user_id,
      appInfo.deviceId,
      appInfo.appVersion,
      appInfo.modelName,
      appInfo.osVersion,
      appInfo.sdkInt,
      appInfo.manufacturer,
      appInfo.isBatteryOptimized,
      appInfo.isStudent,
      appInfo.devicePushTokenVoip,
    ]);
  },
  Get_AppInfo_List: async function (filters) {
    console.log(filters);
    return getmultipleSP("Get_AppInfo_List", [
      filters.isStudent,
      filters.appVersion || "",
      filters.fromDate || null,
      filters.toDate || null,
      filters.nameSearch || "",
      filters.isBatteryOptimized === undefined
        ? -1
        : filters.isBatteryOptimized, // Default to -1 if undefined
      filters.page,
      filters.pageSize,
    ]);
  },
  Get_AppInfo: async function (is_Student, id) {
    console.log(is_Student, id);
    return getmultipleSP("Get_AppInfo", [is_Student, id]);
  },
  Save_Call_Log: async function (data) {
    console.log('[Save_Call_Log model] params:', {
      Call_Log_ID: data.Call_Log_ID || 0,
      Student_ID: data.Student_ID,
      User_ID: data.User_ID,
      Call_Date: data.Call_Date,
      Call_Status: data.Call_Status,
      Remark: data.Remark,
    });
    return executeTransaction("Save_Call_Log", [
      data.Call_Log_ID || 0,
      data.Student_ID,
      data.User_ID,
      data.Call_Date,
      data.Call_Status,
      data.Remark
    ]);
  },
  Save_Call_Logs_Batch: async function (logs) {
    if (!Array.isArray(logs) || logs.length === 0) return { savedCount: 0 };

    let savedCount = 0;
    for (const log of logs) {
      // Prevent Duplicates: Check if this specific call (timestamp + number) already exists
      const checkSql = 'SELECT COUNT(*) as count FROM call_logs WHERE number = ? AND timestamp = ?';
      const [rows] = await db.promise().query(checkSql, [log.number, log.timestamp]);
      
      if (rows[0].count === 0) {
        const insertSql = `INSERT INTO call_logs 
          (number, name, call_type, duration, timestamp, user_id, user_name) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`;
        await db.promise().query(insertSql, [
          log.number,
          log.name || null,
          log.call_type,
          log.duration,
          log.timestamp,
          log.user_id,
          log.user_name || null
        ]);
        savedCount++;
      }
    }
    return { savedCount, totalReceived: logs.length };
  },
  Get_Enquiry_Summary: async function (fromDate, toDate) {
    return getmultipleSP("Get_Enquiry_Summary", [fromDate || null, toDate || null]);
  },
  Get_Status_Count_Report: async function (fromDate, toDate) {
    const sql = `
      SELECT 
        fs.Status_Id,
        fs.Status_Name, 
        fs.Status_Color,
        COUNT(s.Student_ID) as RecordCount
      FROM followup_status fs
      LEFT JOIN student s ON fs.Status_Id = s.Status_Id 
        AND IFNULL(s.Delete_Status, 0) = 0
        ${fromDate && toDate ? 'AND s.Entry_Date BETWEEN ? AND ?' : ''}
      WHERE IFNULL(fs.Delete_Status, 0) = 0
      GROUP BY fs.Status_Id, fs.Status_Name, fs.Status_Color
      ORDER BY fs.Display_Order;
    `;
    const params = fromDate && toDate ? [fromDate, toDate] : [];
    const [rows] = await db.promise().query(sql, params);
    return rows;
  },
  Get_Lead_Dashboard_Summary: async function (fromDate, toDate, staffId) {
    let whereClause = "WHERE IFNULL(s.Delete_Status, 0) = 0 AND s.Is_Registered = 0 ";
    const params = [];

    if (fromDate && toDate) {
      whereClause += " AND s.Entry_Date BETWEEN ? AND ? ";
      params.push(fromDate, toDate);
    }
    if (staffId) {
      whereClause += " AND s.To_User_Id = ? ";
      params.push(staffId);
    }

    const cte = `
      WITH ranked_fu AS (
        SELECT Student_ID, Follow_Up_Status_ID, Next_Follow_Up_Date
        FROM (
          SELECT Student_ID, Follow_Up_Status_ID, Next_Follow_Up_Date,
                 ROW_NUMBER() OVER (PARTITION BY Student_ID ORDER BY Created_Date DESC, Follow_Up_ID DESC) AS rn
          FROM student_followup
          WHERE Delete_Status = 0
        ) t
        WHERE rn = 1
      )
    `;

    // 1. General Metrics Query
    const metricsSql = `
      ${cte}
      SELECT 
        SUM(CASE WHEN COALESCE(rf.Next_Follow_Up_Date, s.Follow_Up_Date) < CURRENT_DATE() AND COALESCE(rf.Follow_Up_Status_ID, s.Status_Id, 0) NOT IN (17, 22) THEN 1 ELSE 0 END) as MissedLeads,
        SUM(CASE WHEN COALESCE(rf.Next_Follow_Up_Date, s.Follow_Up_Date) = CURRENT_DATE() OR COALESCE(rf.Follow_Up_Status_ID, s.Status_Id) = 25 THEN 1 ELSE 0 END) as FollowupLeads,
        SUM(CASE WHEN s.To_User_Id IS NOT NULL AND IFNULL(s.By_User_Id, 0) > 0 AND s.To_User_Id <> s.By_User_Id THEN 1 ELSE 0 END) as TransferredLeads,
        COUNT(s.Student_ID) as TotalLeads,
        SUM(CASE WHEN COALESCE(rf.Next_Follow_Up_Date, s.Follow_Up_Date) > CURRENT_DATE() AND COALESCE(rf.Follow_Up_Status_ID, s.Status_Id, 0) NOT IN (17, 22) THEN 1 ELSE 0 END) as UpcomingFollowup
      FROM student s
      LEFT JOIN ranked_fu rf ON s.Student_ID = rf.Student_ID
      ${whereClause}
    `;

    // 2. Dynamic Status Counts Query
    const statusSql = `
      ${cte}
      SELECT 
        fs.Status_Id,
        fs.Status_Name,
        fs.Status_Color,
        COUNT(s.Student_ID) as LeadCount
      FROM followup_status fs
      LEFT JOIN (
        SELECT s.Student_ID, COALESCE(r_fs.Status_Name, s.Status_Name) as Final_Status_Name
        FROM student s
        LEFT JOIN ranked_fu rf ON s.Student_ID = rf.Student_ID
        LEFT JOIN followup_status r_fs ON r_fs.Status_Id = rf.Follow_Up_Status_ID
        ${whereClause}
      ) s ON s.Final_Status_Name COLLATE utf8mb4_unicode_ci = fs.Status_Name COLLATE utf8mb4_unicode_ci
      WHERE IFNULL(fs.Delete_Status, 0) = 0
      GROUP BY fs.Status_Id, fs.Status_Name, fs.Status_Color
      ORDER BY fs.Display_Order;
    `;

    const [metricsRows] = await db.promise().query(metricsSql, params);
    const [statusRows] = await db.promise().query(statusSql, params);

    return {
      metrics: metricsRows[0] || {},
      statusCounts: statusRows || []
    };
  },
  Get_Today_Followups: async function () {
    const sql = `
      SELECT 
        s.Student_ID,
        CONCAT(IFNULL(s.First_Name, ''), ' ', IFNULL(s.Last_Name, '')) AS Name,
        s.First_Name,
        s.Last_Name,
        s.Phone_Number,
        s.Email,
        sf.Next_Follow_Up_Date,
        IFNULL(sf.Follow_Up_Status_Name, 'Follow back') AS Status_Name,
        COALESCE(NULLIF(sf.Assigned_Staff_Name, ''), NULLIF(s.To_User_Name, ''), '-') AS Assigned_Staff_Name
      FROM student s
      INNER JOIN student_followup sf 
        ON sf.Follow_Up_ID = (
          SELECT sf2.Follow_Up_ID 
          FROM student_followup sf2 
          WHERE sf2.Student_ID = s.Student_ID 
            AND IFNULL(sf2.Delete_Status, 0) = 0
          ORDER BY COALESCE(sf2.Updated_Date, sf2.Created_Date) DESC, sf2.Follow_Up_ID DESC 
          LIMIT 1
        )
      WHERE IFNULL(s.Delete_Status, 0) = 0
        AND DATE(sf.Next_Follow_Up_Date) = CURDATE()
        AND (
          sf.Follow_Up_Status_Name IS NULL 
          OR LOWER(REPLACE(sf.Follow_Up_Status_Name, ' ', '')) IN ('followback', 'follow-back')
        )
      ORDER BY s.Student_ID DESC
    `;
    const [rows] = await db.promise().query(sql);
    return rows;
  },
  Get_Pending_Followups: async function () {
    const sql = `
      SELECT 
        s.Student_ID,
        CONCAT(IFNULL(s.First_Name, ''), ' ', IFNULL(s.Last_Name, '')) AS Name,
        s.First_Name,
        s.Last_Name,
        s.Phone_Number,
        s.Email,
        sf.Next_Follow_Up_Date,
        IFNULL(sf.Follow_Up_Status_Name, 'Follow back') AS Status_Name,
        COALESCE(NULLIF(sf.Assigned_Staff_Name, ''), NULLIF(s.To_User_Name, ''), '-') AS Assigned_Staff_Name
      FROM student s
      INNER JOIN student_followup sf 
        ON sf.Follow_Up_ID = (
          SELECT sf2.Follow_Up_ID 
          FROM student_followup sf2 
          WHERE sf2.Student_ID = s.Student_ID 
            AND IFNULL(sf2.Delete_Status, 0) = 0
          ORDER BY COALESCE(sf2.Updated_Date, sf2.Created_Date) DESC, sf2.Follow_Up_ID DESC 
          LIMIT 1
        )
      WHERE IFNULL(s.Delete_Status, 0) = 0
        AND DATE(sf.Next_Follow_Up_Date) < CURDATE()
        AND (
          sf.Follow_Up_Status_Name IS NULL 
          OR LOWER(REPLACE(sf.Follow_Up_Status_Name, ' ', '')) IN ('followback', 'follow-back')
        )
      ORDER BY sf.Next_Follow_Up_Date DESC, s.Student_ID DESC
    `;
    const [rows] = await db.promise().query(sql);
    return rows;
  },
  Get_Interested_Leads: async function () {
    const sql = `
      SELECT 
        s.Student_ID,
        CONCAT(IFNULL(s.First_Name, ''), ' ', IFNULL(s.Last_Name, '')) AS Name,
        s.First_Name,
        s.Last_Name,
        s.Phone_Number,
        s.Email,
        sf.Next_Follow_Up_Date,
        IFNULL(sf.Follow_Up_Status_Name, 'Interested') AS Status_Name,
        COALESCE(NULLIF(sf.Assigned_Staff_Name, ''), NULLIF(s.To_User_Name, ''), '-') AS Assigned_Staff_Name
      FROM student s
      INNER JOIN student_followup sf 
        ON sf.Follow_Up_ID = (
          SELECT sf2.Follow_Up_ID 
          FROM student_followup sf2 
          WHERE sf2.Student_ID = s.Student_ID 
            AND IFNULL(sf2.Delete_Status, 0) = 0
          ORDER BY COALESCE(sf2.Updated_Date, sf2.Created_Date) DESC, sf2.Follow_Up_ID DESC 
          LIMIT 1
        )
      WHERE IFNULL(s.Delete_Status, 0) = 0
        AND LOWER(REPLACE(sf.Follow_Up_Status_Name, ' ', '')) = 'interested'
      ORDER BY s.Student_ID DESC
    `;
    const [rows] = await db.promise().query(sql);
    return rows;
  },
};
module.exports = student;


