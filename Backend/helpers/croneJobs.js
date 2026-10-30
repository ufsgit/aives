require('dotenv').config();
const cron = require('node-cron');
const { executeTransaction } = require('./sp-caller');
const { subscribeToTopic, sendNotifToTopic } = require('./firebase');
const AWS = require('aws-sdk');
var teacher = require('../models/teacher');
const axios = require('axios');
const moment = require('moment-timezone');

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || "us-east-2",
});

const s3 = new AWS.S3();

// Logging function
function log(level, message, error = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

    if (level === 'error' && error) {
        console.error(logMessage, error);
    } else {
        console.log(logMessage);
    }
}

async function checkAndNotifyInactiveStudents() {
    try {
        // Fetch inactive students
        const students = await executeTransaction('Get_InActive_Students', []);
    
        // Filter and map students with valid phone numbers
        const studentsWithMobile = students
            .filter(student => student.Phone_Number != null && student.Phone_Number != '')
            .map(student => ({ 
                name: student.First_Name, 
                mobile: student.Phone_Number, 
                studentId: student.Student_ID 
            }));
    
        for (const student of students) {
            try {
                // Send inactivity reminder notification to the user's topic
                const data = {
                    type: 'inactivity_reminder',
                    student_id: `${student.Student_ID}`,
                    timestamp: new Date().toISOString()
                };
                const userTopic = `STD-${student.Student_ID}`;
                await sendNotifToTopic(userTopic, "Study Reminder", `Hi ${student.First_Name}, it's been a while! Open our app and continue your learning journey.`, data);
    
                log('info', `Reminder notification sent to student: ${student.Student_ID}`);
            } catch (error) {
                log('error', `Error sending notification to student ${student.Student_ID}:`, error);
            }
        }
    
        // Send WhatsApp messages to students with mobile numbers
        for (const student of studentsWithMobile) {
            const data = {
                messaging_product: "whatsapp",
                to: "91" + student.mobile, // Replace with recipient's number
                type: "template",
                template: {
                    name: "inactive_reminder", // Use the template name you created
                    language: {
                        code: "en"
                    },
                    components: [
                        {
                            type: "body",
                            parameters: [
                                { type: "text", text: student.name }
                            ]
                        }
                    ]
                }
            };
    
            try {
                const response = await axios.post(
                    `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
                    data,
                    {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                        }
                    }
                );
                console.log(` Study Reminder WhatsApp message sent ${student.Student_ID} to ${student.mobile}:`, response.data);
            } catch (error) {
                console.error(`Error sending Study Reminder WhatsApp message to ${student.mobile}:`, error.response ? error.response.data : error.message);
            }
        }
    } catch (error) {
        log('error', 'Error in checkAndNotifyInactiveStudents:', error);
    }
}



//  cron.schedule('*/5 * * * * *', async () => {

// cron.schedule('0 9 * * *', async() => { // Schedule to run every day at 9 AM
//     log('info', 'Running course expiry check...');
//     try {
//         await checkAndNotifyExpiringCourses();
//         log('info', 'Course expiry check completed successfully');
//     } catch (error) {
//         log('error', 'Course expiry check failed:', error);
//     }
// });
// checkAndNotifyInactiveStudents();


async function checkAndNotifyExpiringCourses() {
    try {
        const students = await executeTransaction('Get_Expiring_Courses', []);
        for (const student of students) {
            try {
                const data = {
                    type: 'expiry_reminder',
                    student_id: `${student.Student_ID}`,
                    course_id: `${student.Course_ID}`,
                    expiry_date: `student.Expiry_Date`,
                    timestamp: new Date().toISOString()
                };
                const userTopic = `STD-${student.Student_ID}`;

                await sendNotifToTopic(userTopic, "Course Expiry Reminder",
                    `Hi ${student.First_Name}, your course is about to expire on ${student.Expiry_Date}. Make sure to finish it before the deadline!`, data);

                log('info', `Expiry reminder sent to student: ${student.Student_ID}`);
            } catch (error) {
                log('error', `Error sending expiry notification to student ${student.Student_ID}:`, error);
            }
        }
    } catch (error) {
        log('error', 'Error in checkAndNotifyExpiringCourses:', error);
    }
}

async function deleteS3Object(key) {
    const params = {
        Bucket: process.env.AWS_S3_BUCKET || 'ufsnabeelphotoalbum',
        Key: key
    };
    try {
        await s3.deleteObject(params).promise();
        log('info', `Deleted S3 object: ${key}`);
    } catch (error) {
        log('error', `Error deleting S3 object: ${key}`, error);
        throw error;
    }
}

async function cleanupOldS3Data() {
    try {
        const records = await executeTransaction('Get_Last_Day_Recordings', []);
        console.log('records: ', records);
        for (const record of records) {
            try {
                await deleteS3Object(record.Record_Class_Link);
                await executeTransaction('Update_LiveClass_RecordLink', [record.LiveClass_ID]);
                log('info', `Cleaned up data for LiveClass_ID: ${record.LiveClass_ID}`);
            } catch (error) {
                log('error', `Error processing record ${record.LiveClass_ID}:`, error);
            }
        }
    } catch (error) {
        log('error', 'Error in cleanupOldS3Data:', error);
    }
}

// Schedule the student inactivity check to run every hour
cron.schedule('0 6 * * *', async () => {
    log('info', 'Running student inactivity check...');
    try {
        await checkAndNotifyInactiveStudents();
        log('info', 'Student inactivity check completed successfully');
    } catch (error) {
        log('error', 'Student inactivity check failed:', error);
    }
});


// Schedule the S3 data cleanup to run daily at midnight

// cron.schedule('0 0 * * *', async() => {
//     // cron.schedule('*/5 * * * * *', async () => {
//     log('info', 'Running S3 data cleanup...');
//     try {
//         await cleanupOldS3Data();
//         log('info', 'S3 data cleanup completed successfully');
//     } catch (error) {
//         log('error', 'S3 data cleanup failed:', error);
//     }
// });


 scheduleClassNotifications();

cron.schedule('1 0 * * *', () => { 
    //  cron.schedule('*/15 * * * * *', async () => {

    console.log('Running daily class notification scheduler');
    scheduleClassNotifications();
});
async function scheduleClassNotifications() {
    try {
        const todaysClasses = await executeTransaction('Get_All_Live_Class', []);
        
        // Get current time in IST
        const istTime = moment().tz('Asia/Kolkata');
        
        for (const classInfo of todaysClasses) {
            try {
                const data = {
                    type: 'class_reminder',
                    batch_id: `${classInfo.batch_id}`,
                    start_time: `${classInfo.start_time}`,
                    Course_Name: `${classInfo.Course_Name}`,
                    timestamp: istTime.toISOString()
                };
                
                const batchTopic = `BATCH-${classInfo.batch_id}`;
                
                // Parse class start time
                const classStartTime = parseClassTime(classInfo.start_time);
                const notificationTime = moment(classStartTime).subtract(30, 'minutes');
                
                const timeUntilClass = classStartTime.diff(istTime);
                const timeUntilNotification = notificationTime.diff(istTime);

                if (classStartTime.isAfter(istTime)) {
                    if (timeUntilNotification > 0) {
                        setTimeout(async() => {
                            await sendNotification(batchTopic, classInfo, data, "30 minutes");
                            await sendBatchWhatsappNotification(classInfo.batch_id, classInfo, data, "30 minutes");
                        }, timeUntilNotification);
                        
                        log('info', `[IST ${istTime.format('hh:mm:ss A')}] Scheduled reminder for Batch: ${classInfo.batch_id} for ${classInfo.start_time} at ${notificationTime.format('hh:mm:ss A')}, within ${(timeUntilNotification/60000).toFixed(2)} minutes`);
                    } else if (timeUntilClass <= 30 * 60000) {
                        await sendNotification(batchTopic, classInfo, data, "soon");
                        await sendBatchWhatsappNotification(classInfo.batch_id, classInfo, data, "soon");
                        
                        log('info', `[IST ${istTime.format('hh:mm:ss A')}] Sent immediate reminder for Batch: ${classInfo.batch_id}`);
                    }
                }
            } catch (error) {
                log('error', `Error scheduling notification for Batch ${classInfo.batch_id}:`, error);
            }
        }
    } catch (error) {
        log('error', 'Error fetching today\'s classes:', error);
    }
}

// Parse class time considering IST
function parseClassTime(timeStr) {
    // If timeStr is in HH:mm format
    if (timeStr.includes(':') && timeStr.length <= 5) {
        const [hours, minutes] = timeStr.split(':');
        return moment().tz('Asia/Kolkata').hours(hours).minutes(minutes).seconds(0).milliseconds(0);
    }
    
    // If timeStr is a complete date string
    return moment.tz(timeStr, 'Asia/Kolkata');
}

async function sendNotification(topic, classInfo, data, timePhrase) {
    const classStartTime = parseClassTime(classInfo.start_time);
    const formattedTime = classStartTime.format('h:mm A');  // Will output like "6:05 PM"
    const currentTime = moment().tz('Asia/Kolkata');

    await sendNotifToTopic(
        topic,
        "Upcoming Class Reminder",
        `This is a friendly reminder that your "${classInfo.Batch_Name}" class will begin in ${timePhrase} at ${formattedTime} today.`,
        data
    );

    log('info', `Reminder sent for batch: ${classInfo.batch_id} for ${classInfo.start_time} at ${currentTime.format('hh:mm:ss A')}`);
}

async function sendBatchWhatsappNotification(batch_id, classInfo, data, timePhrase) {
    console.log('batch_id: ', batch_id);
    const today = new Date(); 
    const [hours, minutes] = classInfo.start_time.split(':');
    const classStartTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);

    const formattedTime = classStartTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });


    const studentsList = await teacher.Get_Batch_StudentList(batch_id);
    const studentsWithMobile = studentsList
    .filter(student => student.Phone_Number != null && student.Phone_Number != '')
    .map(student => ({ 
        name: student.Name,
        mobile: student.Phone_Number,
        countryCode: student.Country_Code || '91' // Default to '91' if no country code
    }));

    for (let mobile of studentsWithMobile) {
        try {
            data = {
                messaging_product: "whatsapp",
                to: (mobile.countryCode.replace('+', '') + mobile.mobile).replace(/\D/g, ''), 
                type: "template",
                template: {
                    name: "live__scheduled_2", // Use the template name you created
                    language: {
                        code: "en_US",
                    },
                    components: [  
                        {
                            type: "body",
                            parameters: [
                                {
                                    type: "text",
                                    text:mobile.name?mobile.name:'Trackbox'
                                },
                                {
                                    type: "text",
                                    text: classInfo.Batch_Name
                                },
                                {
                                    type: "text",
                                    text: timePhrase 
                                },
                                {
                                    type: "text",
                                    text: formattedTime 
                                }
                            ]
                        }
                    ],
                },
            };
        
            try {
             response = await axios.post(
                    `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
                    data, {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                        },
                    }
                );
                console.log(`WhatsApp message sent to ${mobile['mobile']}:`, response.data);

            } catch (error) {
                console.error("Error sending Batch message:",mobile, error.response ? error.response.data : error.message);
            }
        
        } catch (error) {
            console.log(error);
            throw error;
        }
        
    }

}
