const db = require('../config/dbconnection');

const Save_Email_Log = (Student_ID, Template_ID, Email_Address, Subject, Message_ID, Body, Status, Error_Message) => {
    return new Promise((resolve, reject) => {
        const query = 'CALL Save_Email_Log(?, ?, ?, ?, ?, ?, ?, ?)';
        db.query(query, [Student_ID, Template_ID, Email_Address, Subject, Message_ID, Body, Status, Error_Message], (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
};

const Update_Email_Opened = (Message_ID) => {
    return new Promise((resolve, reject) => {
        const query = 'CALL Update_Email_Opened(?)';
        db.query(query, [Message_ID], (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
};

const Get_Email_Logs_By_Student = (Student_ID) => {
    return new Promise((resolve, reject) => {
        const query = 'CALL Get_Email_Logs_By_Student(?)';
        db.query(query, [Student_ID], (err, result) => {
            if (err) reject(err);
            else resolve(result[0]); // Returns the first result set
        });
    });
};

const Get_Mail_Report = (fromDate, toDate, templateId) => {
    return new Promise((resolve, reject) => {
        const query = 'CALL Get_Mail_Report(?, ?, ?)';
        db.query(query, [fromDate || null, toDate || null, templateId || null], (err, result) => {
            if (err) reject(err);
            else resolve(result[0]);
        });
    });
};

const Get_Batch_Mail_Report = (courseId, batchId, fromDate, toDate) => {
    return new Promise((resolve, reject) => {
        const query = 'CALL Get_Batch_Mail_Report(?, ?, ?, ?)';
        db.query(query, [courseId || 0, batchId || 0, fromDate || null, toDate || null], (err, result) => {
            if (err) reject(err);
            else resolve(result[0]);
        });
    });
};

module.exports = {
    Save_Email_Log,
    Update_Email_Opened,
    Get_Email_Logs_By_Student,
    Get_Mail_Report,
    Get_Batch_Mail_Report
};

