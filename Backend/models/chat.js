var fs = require('fs');
const { executeTransaction } = require('../helpers/sp-caller');
var chat =
{
    search_chat_history_teacher: async function (Teacher_Id) {
      
        return executeTransaction('search_chat_history_teacher', [Teacher_Id]);
    },
    Get_Chats_Media: async function (student_id_,Teacher_Id) {
        console.log('Teacher_Id: ', Teacher_Id);
        console.log('student_id_: ', student_id_);
      
        return executeTransaction('Get_Chats_Media', [student_id_,Teacher_Id]);
    },

};
module.exports = chat;

