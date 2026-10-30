var fs = require('fs');
const { executeTransaction } = require('../helpers/sp-caller');
var course_category =
{
    Save_course_category: async function (course_category) {
        console.log('course_category: ', course_category);
        console.log('course_category.Category_ID: ', course_category.Category_ID);
        return executeTransaction('Save_course_category', [course_category.Category_ID, course_category.Category_Name]);
    },
    Delete_course_category: async function (course_category_Id_) {
        return executeTransaction('Delete_course_category', [course_category_Id_]);
    },
    Get_course_category: async function (course_category_Id_) {
        return executeTransaction('Get_course_category', [course_category_Id_]);
    },
    Search_course_category: async function (course_category_Name_,allCategoryNeeded='false') {
        console.log('allCategoryNeeded: ', allCategoryNeeded);
        if (course_category_Name_ === undefined || course_category_Name_ === 'undefined')
            course_category_Name_ = '';
        return executeTransaction('Search_course_category', [course_category_Name_,allCategoryNeeded]);
    },
    ChangeStatus(status){
        return executeTransaction('ChangeCategoryStatus', [status.category_Id, status.categoryStatus]);
    }
};
module.exports = course_category;

