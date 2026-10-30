var fs = require('fs');
const { executeTransaction } = require('../helpers/sp-caller');
var course_module =
{
    Save_course_module: async function (course_module) {
        return executeTransaction('Save_course_module', [course_module.Module_ID, course_module.Module_Name]);
    },
    Delete_course_module: async function (course_module_Id_) {
        return executeTransaction('Delete_course_module', [course_module_Id_]);
    },
    Get_course_module: async function (course_module_Id_) {
        return executeTransaction('Get_course_module', [course_module_Id_]);
    },
    Search_course_module: async function (course_module_Name_,allCategoryNeeded='false') {
        console.log('course_module_Name_: ', course_module_Name_);
        console.log('allCategoryNeeded: ', allCategoryNeeded);
        if (course_module_Name_ === undefined || course_module_Name_ === 'undefined' || !course_module_Name_)
            course_module_Name_ = '';
        console.log('course_module_Name_: ', course_module_Name_);
        return executeTransaction('Search_course_module', [course_module_Name_,allCategoryNeeded]);
    },
    Change_Module_Status(status){
        return executeTransaction('Change_Module_Status', [status.Module_Id, status.ModuleStatus]);
    },
    Change_Student_Module_Lock_Status(status){
        return executeTransaction('Change_Student_Module_Lock_Status', [status.Student_ID, status.Course_ID,status.Status]);
    },
    Change_Module_Order(order){
        return executeTransaction('Change_Module_Order', [ JSON.stringify(order) ]);
    },

};
module.exports = course_module;

