var fs = require('fs');
const { executeTransaction ,getmultipleSP} = require('../helpers/sp-caller');
var Batch =
{
    Save_Batch: async function (Batch) {
        console.log('Batch: ', Batch);  
        console.log('Batch.Category_ID: ', Batch.Category_ID);
        return executeTransaction('Save_Batch', [Batch.Batch_ID,Batch.Course_ID, Batch.Batch_Name, JSON.stringify(Batch.scheduledTeachers),Batch.Start_Date,Batch.End_Date ? Batch.End_Date : null]);
    },
    Delete_Batch: async function (Batch_Id_) {
        return executeTransaction('Delete_Batch', [Batch_Id_]);
    },
    Get_Batch: async function (Batch_Id_) {
        return executeTransaction('Get_Batch', [Batch_Id_]);
    },
    Search_Batch: async function (Batch_Name_) {
        if (Batch_Name_ === undefined || Batch_Name_ === 'undefined')
            Batch_Name_ = '';
        return executeTransaction('Search_Batch', [Batch_Name_]);
    },
    ChangeStatus(status){
        return executeTransaction('ChangeCategoryStatus', [status.category_Id, status.categoryStatus]);
    },
    Get_Batch_Details: async function (batchID_) {
        return getmultipleSP('Get_Batch_Details', [batchID_]);
    },
    Get_Batch_Days: async function (userId,Course_Id,Module_ID) {
        return executeTransaction('Get_Batch_Days', [userId,Course_Id,Module_ID]);
    },
    Get_Exam_Days: async function (userId,Course_Id) {
        return executeTransaction('Get_Exam_Days', [userId,Course_Id]);
    }
};
module.exports = Batch;

