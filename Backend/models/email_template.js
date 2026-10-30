const { executeTransaction } = require('../helpers/sp-caller');

const email_template = {
    Save_Email_Template: async function (template) {
        return executeTransaction('Save_Email_Template', [
            template.Template_ID || 0,
            template.Template_Name,
            template.Subject,
            template.Body,
            template.Attendance_Count !== undefined ? parseInt(template.Attendance_Count) : 0,
            template.Is_Active !== undefined ? (template.Is_Active ? 1 : 0) : 1
        ]);
    },
    Get_Email_Template: async function (id) {
        return executeTransaction('Get_Email_Template', [id]);
    },
    Search_Email_Template: async function (searchTerm) {
        return executeTransaction('Search_Email_Template', [searchTerm || '']);
    },
    Delete_Email_Template: async function (id) {
        return executeTransaction('Delete_Email_Template', [id]);
    }
};

module.exports = email_template;
