const { executeTransaction, getmultipleSP } = require("../helpers/sp-caller");
const db = require("../config/dbconnection");

const Attendance = {
  Save_Attendance: async function (attendanceData, markedBy) {
    return executeTransaction("Save_Attendance", [
      JSON.stringify(attendanceData),
      markedBy,
    ]);
  },
  Get_Attendance_History: async function (courseId = 0, batchId = 0, fromDate = '', toDate = '', staffId = 0, page = 1, pageSize = 10, allowedCourseIds = null) {
    const pageNum = parseInt(page) || 1;
    const pageSizeNum = parseInt(pageSize) || 10;
    const offset = Math.max(0, (pageNum - 1) * pageSizeNum);
    const courseIdNum = parseInt(courseId) || 0;
    const batchIdNum = parseInt(batchId) || 0;

    let whereConditions = [];
    let queryParams = [];

    // Role-based course restriction:
    if (allowedCourseIds !== null) {
      if (!Array.isArray(allowedCourseIds) || allowedCourseIds.length === 0) {
        // Staff has no assigned courses -> return 0 records immediately
        return [[{ total_count: 0 }], []];
      }
      if (courseIdNum > 0) {
        if (!allowedCourseIds.includes(courseIdNum)) {
          // Staff requested a course not assigned to them -> return 0 records immediately
          return [[{ total_count: 0 }], []];
        }
        whereConditions.push('am.Course_ID = ?');
        queryParams.push(courseIdNum);
      } else {
        whereConditions.push(`am.Course_ID IN (${allowedCourseIds.map(() => '?').join(',')})`);
        queryParams.push(...allowedCourseIds);
      }
    } else if (courseIdNum > 0) {
      whereConditions.push('am.Course_ID = ?');
      queryParams.push(courseIdNum);
    }
    if (batchIdNum > 0) {
      whereConditions.push('am.Batch_ID = ?');
      queryParams.push(batchIdNum);
    }
    if (fromDate && String(fromDate).trim() !== '') {
      whereConditions.push('am.Attendance_Date >= ?');
      queryParams.push(String(fromDate).trim());
    }
    if (toDate && String(toDate).trim() !== '') {
      whereConditions.push('am.Attendance_Date <= ?');
      queryParams.push(String(toDate).trim());
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const countSql = `
        SELECT COUNT(*) as total_count FROM (
            SELECT am.Attendance_Date, am.Course_ID, am.Batch_ID
            FROM attendance_master am
            ${whereClause}
            GROUP BY am.Attendance_Date, am.Course_ID, am.Batch_ID
        ) as t
    `;

    const dataSql = `
        SELECT 
            DATE_FORMAT(am.Attendance_Date, '%Y-%m-%d') as Attendance_Date, 
            am.Course_ID,
            am.Batch_ID,
            c.Course_Name, 
            b.Batch_Name, 
            CONCAT(IFNULL(u.First_Name, ''), ' ', IFNULL(u.Last_Name, '')) as Marked_By_Name, 
            1 as Session, 
            MAX(ad.Status) as Status,
            SUM(CASE WHEN ad.Status = 1 THEN 1 ELSE 0 END) as Present_Count,
            SUM(CASE WHEN ad.Status = 0 THEN 1 ELSE 0 END) as Absent_Count,
            SUM(CASE WHEN ad.Status = 2 THEN 1 ELSE 0 END) as Leave_Count,
            SUM(CASE WHEN ad.Status = 3 THEN 1 ELSE 0 END) as Late_Count
        FROM attendance_master am
        JOIN attendance_details ad ON am.Attendance_ID = ad.Attendance_ID
        LEFT JOIN course c ON am.Course_ID = c.Course_ID 
        LEFT JOIN course_batch b ON am.Batch_ID = b.Batch_ID 
        LEFT JOIN users u ON am.Marked_By = u.User_ID 
        ${whereClause}
        GROUP BY am.Attendance_Date, am.Course_ID, am.Batch_ID, am.Marked_By 
        ORDER BY am.Attendance_Date DESC
        LIMIT ${pageSizeNum} OFFSET ${offset}
    `;

    const [countRes] = await db.promise().query(countSql, queryParams);
    const [dataRes] = await db.promise().query(dataSql, queryParams);

    return [countRes, dataRes];
  },



  Get_Attendance_Summary_Report: async function (studentId, courseId, batchId, fromDate, toDate, teacherId, status) {
    return getmultipleSP("Get_Attendance_Summary_Report", [
      studentId || 0,
      courseId || 0,
      batchId || 0,
      fromDate || '',
      toDate || '',
      teacherId || 0,
      status === undefined || status === null ? -1 : status,
    ]);
  },
  Delete_Attendance: async function (courseId, batchId, date) {
    return executeTransaction("Delete_Attendance", [
      courseId || 0,
      batchId || 0,
      date || '',
    ]);
  },
  Get_Attendance_Details_By_Session: async function (courseId, batchId, date) {
    return executeTransaction("Get_Attendance_Details_By_Session", [
      courseId || 0,
      batchId || 0,
      date || '',
    ]);
  },
};

module.exports = Attendance;
