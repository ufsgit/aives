var fs = require("fs");
const { executeTransaction, getmultipleSP } = require("../helpers/sp-caller");
var course = {
  Save_course: async function (course) {
    return executeTransaction("save_course", [
      JSON.stringify(course["course"]),
    ]);
  },
  saveCourseFees: async function (CourseFees) {
    console.log("CourseFees", CourseFees);

    return executeTransaction("saveCourseFees", [
        CourseFees.Installment_information_ID,
      CourseFees.fee_type,
      CourseFees.duration,
      CourseFees.Course_Name, // Already a string, no need for JSON.stringify
      CourseFees.amount,
      CourseFees.Course_ID,
      CourseFees.Batch_ID,
      CourseFees.Batch_Name
    ]);
  },
  deleteInstallmentInformation: async function (CourseFees) {
    return executeTransaction("deleteInstallmentInformation", [
        CourseFees.Installment_information_ID,
    ]);
  },
  save_course_content: async function (course) {
    return executeTransaction("save_course_content", [
      JSON.stringify(course["contents"]),
    ]);
  },
  Student_Batch_Change: async function (student) {
    console.log("student: ", student);
    return executeTransaction("Student_Batch_Change", [
      JSON.stringify(student),
    ]);
  },
  ValidateTimeSlots: async function (body) {
    console.log("body: ", body);
    console.log(
      "JSON.stringify(body.timeSlots): ",
      JSON.stringify(body.SchduledTeacher)
    );
    return executeTransaction("ValidateTimeSlots", [
      body.Course_ID,
      JSON.stringify(body.SchduledTeacher),
      body.Start_Date,
      body.End_Date,
    ]);
  },
  Delete_course: async function (course_Id_) {
    return executeTransaction("Delete_course", [course_Id_]);
  },
  Get_course: async function (course_Id_) {
    return getmultipleSP("Get_course", [course_Id_]);
  },
  Get_course_content: async function (course_Id_, contentId) {
    return getmultipleSP("Get_course_content", [course_Id_, contentId]);
  },
  Get_Available_Time_Slot: async function (course_Id_) {
    return getmultipleSP("Get_Available_Time_Slot", [course_Id_]);
  },
  Get_All_Time_Slot: async function (course_Id_) {
    return getmultipleSP("Get_All_Time_Slot", [course_Id_]);
  },
  Get_Free_Time_Slot: async function (course_Id_) {
    return getmultipleSP("Get_Free_Time_Slot", [course_Id_]);
  },
  Search_course: async function (course_Name_, priceFrom, priceTo) {
    console.log("course_Name_: ", course_Name_);
    if (course_Name_ === undefined || course_Name_ === "undefined")
      course_Name_ = "";
    !priceTo ? (priceTo = 0) : priceTo;
    !priceFrom ? (priceFrom = 0) : priceFrom;
    return executeTransaction("Search_course", [
      course_Name_,
      "",
      "",
      priceFrom,
      priceTo,
    ]);
  },
  Search_all_course: async function (course_Name_, priceFrom, priceTo) {
    console.log("course_Name_: ", course_Name_);
    if (course_Name_ === undefined || course_Name_ === "undefined")
      course_Name_ = "";
    !priceTo ? (priceTo = 0) : priceTo;
    !priceFrom ? (priceFrom = 0) : priceFrom;
    return executeTransaction("Search_all_course", [
      course_Name_,
      "",
      "",
      priceFrom,
      priceTo,
    ]);
  },
  get_course_names: async function () {
    return getmultipleSP("get_course_names", []);
  },
  get_course_fees: async function (courseId = 0) {
    return getmultipleSP("get_course_fees", [courseId]);
},
Get_InstallmentsByCourseID: async function (courseId = 0) {
    return getmultipleSP("Get_InstallmentsByCourseID", [courseId]);
},
Get_InstallmentsByFee_Type: async function (courseId,Fee_Type, Batch_ID) {
  console.log(Fee_Type,courseId, Batch_ID);
  
    return getmultipleSP("Get_InstallmentsByFee_Type", [Fee_Type, courseId, Batch_ID]);
},
  Get_All_Course_Items: async function () {
    return getmultipleSP("Get_All_Course_Items", []);
  },
  Get_all_Batch: async function () {
    return getmultipleSP("Get_all_Batch", []);
  },
  Get_Course_Students: async function (course_Id_) {
    return executeTransaction("Get_Course_Students", [course_Id_]);
  },
  Get_Specific_Exam_Details: async function (examID) {
    return executeTransaction("Get_Specific_Exam_Details", [examID]);
  },
  Get_Course_Reviews: async function (student_Id_, course_Id_) {
    return executeTransaction("Get_Course_Reviews", [student_Id_, course_Id_]);
  },
  review_course: async function (params) {
    const { studentId, courseId, rating, comments, Review_Id, Delete_Status } =
      params;
    return executeTransaction("review_course", [
      studentId,
      courseId,
      rating,
      comments,
      Review_Id,
      Delete_Status,
    ]);
  },
  Get_Teachers_By_Course: async function (course_Id_) {
    return executeTransaction("Get_Teachers_By_Course", [course_Id_]);
  },
  Delete_Course_Content: async function (content_Id) {
    return executeTransaction("Delete_Course_Content", [content_Id]);
  },
  Get_Sections_By_Course: async function (course_Id_) {
    return executeTransaction("Get_Sections_By_Course", [course_Id_]);
  },
  get_course_Batches: async function (course_Id_) {
    return executeTransaction("get_course_Batches", [course_Id_]);
  },
  Save_Student_Exam: async function (req) {
    const { examId, score, attemptedDate, answers } = req.body;
    console.log("req.userId: ", req.userId);
    return executeTransaction("Save_Student_Exam", [
      req.userId,
      examId,
      score,
      attemptedDate,
      answers,
    ]);
  },
  Update_LastAccessed_Content: async function (
    studentId,
    courseId,
    lastAccessedContentId
  ) {
    return executeTransaction("Update_LastAccessed_Content", [
      studentId,
      courseId,
      lastAccessedContentId,
    ]);
  },
  Unlock_Exam: async function (
    Content_ID,
    Exam_ID,
    Is_Question_Unlocked,
    Is_Question_Media_Unlocked,
    Batch_ID,
    Is_Answer_Unlocked
  ) {
    return executeTransaction("Unlock_Exam", [
      Content_ID,
      Exam_ID,
      Is_Question_Unlocked,
      Is_Question_Media_Unlocked,
      Batch_ID,
      Is_Answer_Unlocked,
    ]);
  },
  Update_Time_Slot: async function (studentId, courseId, Slot_Id) {
    return executeTransaction("Update_Time_Slot", [
      studentId,
      courseId,
      Slot_Id,
    ]);
  },
  Get_course_content_By_Module: async function (course_Id_, Module_ID_) {
    return getmultipleSP("Get_course_content_By_Module", [
      course_Id_,
      Module_ID_,
    ]);
  },
  Get_course_content_By_Day: async function (
    course_Id_,
    Module_ID_,
    Section_ID,
    Day_Id,
    userId,
    isLibrary = 1,
    Batch_ID,
    Is_Exam_Test = 0
  ) {
    console.log("userId: ", userId);
    const visibilityType = isLibrary == "true" ? 2 : 1;
    console.log("isLibrary: ", isLibrary);
    console.log("visibilityType: ", visibilityType);
    return getmultipleSP("Get_course_content_By_Day", [
      course_Id_,
      Module_ID_,
      Section_ID,
      Day_Id,
      userId,
      visibilityType,
      Batch_ID,
      Is_Exam_Test,
    ]);
  },
  Get_Course_Module: async function () {
    return getmultipleSP("Get_Course_Module", []);
  },
  Get_Course_Info: async function (course_Id_) {
    return getmultipleSP("Get_Course_Info", [course_Id_]);
  },
  get_Examof_Course: async function (course_Id_) {
    return getmultipleSP("get_Examof_Course", [course_Id_]);
  },
  Get_Student_List_By_Batch: async function (batch_Id) {
    return getmultipleSP("Get_Student_List_By_Batch", [batch_Id]);
  },
  Get_Module_Of_Course: async function (course_Id_, userId) {
    return getmultipleSP("Get_Module_Of_Course", [course_Id_, userId]);
  },
  Get_Exam_Days_By_Module: async function (userId, course_Id_, Module_ID) {
    return getmultipleSP("Get_Exam_Days_By_Module", [
      userId,
      course_Id_,
      Module_ID,
    ]);
  },
  Get_Exam_Modules_By_CourseId: async function (course_Id_) {
    return getmultipleSP("Get_Exam_Modules_By_CourseId", [course_Id_]);
  },
  Get_Student_ClassRecords: async function (
    course_Id_,
    batch_Id,
    studentId,
    isStudent = 1
  ) {
    return getmultipleSP("Get_Student_ClassRecords", [
      course_Id_,
      batch_Id,
      studentId,
      isStudent,
    ]);
  },
};
module.exports = course;
