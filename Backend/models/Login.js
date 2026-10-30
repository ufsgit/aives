const {executeTransaction} = require('../helpers/sp-caller');


const Login = {


    Login_Check: async function(username, password, Device_ID) {
        return executeTransaction('Login_Check', [
            username, password, Device_ID
        ]);
    },

    Save_user: async function(user) {

        return executeTransaction('Save_User', [
            user.User_ID,
            user.First_Name,
            user.Last_Name,
            user.Email,
            user.PhoneNumber,
            user.Delete_Status,
            user.User_Type_Id,
            user.User_Role_Id,
            user.User_Status,
            user.password,
            user.Device_ID,
            user.Profile_Photo_Name,
            user.Profile_Photo_Path,
            JSON.stringify(user.Course_ID),
            user.Hod,
            JSON.stringify(user.teacherCourses),        
       
        ]);
    },
   
    Check_User_Exist: async function(email, mobile,  country_code = '+91', country_code_name = 'IN',otp, Device_ID = 0) {

    
        return executeTransaction('Check_User_Exist', [
            email, mobile, country_code, country_code_name, otp, Device_ID
        ]);
    },
    
      
    Update_User_OTP: async function(Email,otp,token) {
    
        return executeTransaction('Update_User_OTP', [
            Email,otp,token
        ]);
    },

    change_password: async function(password, id,token) {
     

        
        return executeTransaction('change_password', [
            password,id,token 
        ]);
    },
    Check_OTP: async function(student_id,otp,isStudnet) { 
    
        return executeTransaction('Check_OTP', [
            student_id,otp,isStudnet
        ]);
    }, 

    Generate_forget_Password: async function(email, token, userType) {
        return executeTransaction('Generate_forget_Password', [
            email, token, userType
        ]);
    },
    forgot_password: async function(token, password, userType, user_Id) {
        return executeTransaction('Forgot_Password', [
            token, password, userType, user_Id
        ]); 
    },
    Register_User_Request: async function(userData) {
        return executeTransaction('Register_User_Request', [
            userData.First_Name,
            userData.Last_Name,
            userData.Email,
            userData.PhoneNumber,
            userData.Password,
            userData.Profile_Photo_Path || null,
            userData.Profile_Photo_Name || null
        ]);
    },
};

module.exports = Login;