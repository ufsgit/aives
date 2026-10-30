const fs = require("fs");
const { executeTransaction, getmultipleSP } = require("../helpers/sp-caller");
const Exam = {
  Save_Exam_Questions: async function (body) {
    const metadata = {
         Exam_ID: body.Exam_ID, 
      Course_ID: body.Course_ID,
      Course_Name: body.Course_Name,
      Time_Limit: body.Time_Limit,
      Passing_Score: body.Passing_Score,
      Main_Question: body.Main_Question,
    };

    const payload = body.Questions.map((q) => ({
      ...q,
      Answer_Options: JSON.stringify(q.Answer_Options),
      Course_ID: metadata.Course_ID,
      Course_Name: metadata.Course_Name,
      Time_Limit: metadata.Time_Limit,
      Passing_Score: metadata.Passing_Score,
      Main_Question: metadata.Main_Question,
      Exam_ID: metadata.Exam_ID
    }));

    return executeTransaction("Save_Exam_Questions", [JSON.stringify(payload)]);
  },
  Get_Exams_With_Course: async function (courseId) {
    return getmultipleSP("Get_Exams_With_Course", [courseId]);
  },
  Delete_Exam: async function (Exam_ID) {
    return executeTransaction("Delete_Exam", [Exam_ID]);
  },
  Get_questions: async function (Exam_ID) {
    return getmultipleSP("Get_questions", [Exam_ID]);
  },
  Get_Exam_Details: async function (Exam_ID) {
    return getmultipleSP("Get_Exam_Details", [Exam_ID]);
  },
};
module.exports = Exam;
