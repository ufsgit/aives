const { getmultipleSP, executeTransaction } = require('./sp-caller');
const {subscribeToTopic,sendNotifToTopic} = require('../helpers/firebase');

function initializeTeacherChat(io) {
    io.on('connection', (socket) => {
        console.log('A user connected');
      
        const handleError = (operation, error) => {
            console.error(`Error ${operation}:`, error);
            socket.emit('error', { message: `Failed to ${operation}` });
        };

        const joinRoom = (roomId,emit) => {
            socket.join(roomId);
            console.log(`User joined ${roomId} ${emit}`);
        };

        const leaveRoom = (roomId) => {
            socket.leave(roomId);
            console.log(`User left ${roomId}`);
        };

        const getListId = (id, isStudent,chatType='teacher_student') => `${id}-List${isStudent ? 'student' : 'Teacher'}${chatType}`;


        const getConversationId = (senderId, receiverId, chatType) => `${chatType}-${senderId}-${receiverId}`;

        socket.on('join conversation', async({ teacherId, studentId, isStudent, chatType = 'teacher_student', courseId }) => {
            const conversationId = getConversationId(teacherId, studentId, chatType);
            joinRoom(conversationId,'join conversation');
        
            try {
                let results;
                if (chatType === 'teacher_student') {
                  const read=  await executeTransaction('mark_as_read', [teacherId, studentId, isStudent, chatType]);
                    results = await getmultipleSP('get_chat_call_history', [teacherId, studentId]);
                } else {
                    await executeTransaction('mark_as_read', [teacherId, studentId, isStudent, chatType]);
                    results = await getmultipleSP('`get_hod_chat_history`', [studentId, courseId]);
                }
                io.to(conversationId).emit('chat history', results[0][0]['result_json']);
            } catch (error) {
                handleError('retrieving chat history', error);
            }
        });
 
   
        socket.on('get list', async({ id, isStudent ,chatType='teacher_student'}) => { 
            const listId = getListId(id, isStudent,chatType);
            joinRoom(listId,'get list');
            let list
            const [teacherId, studentId] = isStudent ? [0, id] : [id, 0];
            try {
                if (chatType === 'teacher_student') {
                const sender = isStudent ? 'student' : 'teacher';

                 list = await executeTransaction('Get_Calls_And_Chats_List', ['chat', sender, teacherId, studentId]);
          
            }else{
                 list = await executeTransaction('Get_ChatList_Hod', [ teacherId]);
                }
 
                io.to(listId).emit('chat list', list); 
            } catch (error) {
                handleError('retrieving chat list', error);
            }
        });
        socket.on('Check_Call_Availability', async({ user_Id, is_Student_Calling,chatType='teacher_student' }) => { 
            
            try { 
                console.log('user_Id: ', user_Id);
                const listId = getListId(user_Id, is_Student_Calling,chatType);
            joinRoom(listId,'Check_Call_Availability');
            console.log('listId: ', listId);

                 list = await executeTransaction('Check_Call_Availability', [user_Id, is_Student_Calling]);
          
                io.to(listId).emit('User_Availability_Status', list);
            } catch (error) {
                handleError('retrieving chat list', error);
            }
        });

        
        socket.on('Get_Ongoing_Calls', async({ user_Id, isStudent=0 }) => { 
            
            try { 
                console.log('user_Id: ', user_Id);
             const userTopic = `${isStudent?`STD-`:`TCR-`}${user_Id}`;
             console.log('userTopic: ', userTopic);

              joinRoom(userTopic,'Get_Ongoing_Calls');

              list = await executeTransaction('Get_Ongoing_Calls', [user_Id, isStudent]);
              
            //   console.log('list:Get_Ongoing_Calls ', list);
          
              io.to(userTopic).emit('Get_Ongoing_Calls', list);
            } catch (error) {
                handleError('retrieving Get_Ongoing_Calls list', error);
            }
        });
        socket.on('Get_Live_Classes_By_CourseId', async({ user_Id, course_Id,batch_Id}) => { 
            
            try { 
                const userTopic = `Grp-${course_Id}-${batch_Id}`;
                console.log('userTopic3: ', userTopic);

              joinRoom(userTopic,'Get_Live_Classes_By_CourseId');

              list = await executeTransaction('Get_Live_Classes_By_CourseId', [course_Id,0,batch_Id]);
              console.log('list:Get_Live_Classes_By_CourseId ', list);
              io.to(userTopic).emit('Get_Live_Classes_By_CourseId', list);
            } catch (error) {
                handleError('retrieving Get_Live_Classes_By_CourseId list', error);
            }
        });

        socket.on('leave chatlist', ({ id, isStudent,chatType='teacher_student' }) => {
            leaveRoom(getListId(id, isStudent,chatType));
        });


        socket.on('send message', async({ teacherId, studentId, message, chatType = 'teacher_student', course_id, isStudent, File_Path,fileSize,thumbUrl ,senderName='',profileUrl=''}) => {
            // console.log('chatType: ', chatType);
            // console.log('isStudent: ', isStudent);
            // console.log('teacherId: ', teacherId);
            // console.log('studentId: ', studentId);
            
            // console.log('senderName: ', senderName);
            // console.log('course_id: ', course_id);
            let msgHeading;
            senderName !=''?msgHeading=`New Message from ${senderName} `:'New Message'
            const conversationId = getConversationId(teacherId, studentId, chatType);
            const ToUser = isStudent ? teacherId : studentId;
            const sendToId = `${ToUser}-List${isStudent ? 'Teacher' : 'student'}${chatType}`;
            console.log('sendToId: ', sendToId);
            console.log(' socket.id:teacher ',  socket.id);
            
            const deviceId = await executeTransaction('Get_DeviceId_By_userId', [ToUser, !isStudent]);
            try {
                if (chatType === 'teacher_student') {
                    await getmultipleSP('insert_chat_message', [teacherId, studentId, message, isStudent, File_Path,fileSize,thumbUrl]);
                    const sender = isStudent ? 'teacher' : 'student';
                    const [listTeacherId, listStudentId] = sender == 'teacher' ? [teacherId, 0] : [0, studentId];
                    
                    const list = await executeTransaction('Get_Calls_And_Chats_List', ['chat', sender, listTeacherId, listStudentId]);
                    io.to(sendToId).emit('chat list', list);
                    io.to(conversationId).emit('new message', { teacherId, studentId, message, chatType, course_id, isStudent, File_Path,fileSize,thumbUrl});
                    
                } else {
                    await getmultipleSP('insert_hod_chat_message', [teacherId, studentId, course_id, message, isStudent, File_Path,fileSize,thumbUrl]);
                   if( isStudent)
                   {

                       const list = await executeTransaction('Get_ChatList_Hod', [teacherId]);
                       io.to(sendToId).emit('chat list', list);
                    }
                    io.to(conversationId).emit('new message', { teacherId, studentId, message, chatType, course_id, isStudent, File_Path,fileSize,thumbUrl});
                }
             

                                // var message = {
                                //     registration_ids: [deviceId[0]['Device_ID']],
                                //     notification: {
                                //         title: 'New Message',
                                //         body: "You have received a new message",
                                //         sound: 'default'
                                //     },
                                //     data: {
                                //         type: 'new_message',
                                //         sender_id: `${isStudent ? studentId : teacherId}`,
                                //         receiver_id: `${isStudent ? teacherId : studentId}`,
                                //         message_content: message, // Assuming the latest message is available in the list
                                //         timestamp: new Date().toISOString()
                                //     }
                                // };
            
                                // fcm.send(message, function(err, response) {
                                //     if (err) {
                                //         console.log("Something has gone wrong!" + err);
                                //         console.log("Response:!" + response);
            
                                //     } else {
                                //         console.log("Successfully sent with response: ", response);
                                //         console.log("Response:!" + response['results'][0]['error']);
                                //     }
                                // }); 
                             
                         
                                const userTopic = `${!isStudent?`STD-`:`TCR-`}${ToUser}`;
                        
                                let data= {
                                            type: 'new_message',
                                            course_id:String(course_id),
                                            senderName,
                                            profileUrl,
                                            sender_id: `${isStudent ? studentId : teacherId}`,
                                            receiver_id: `${isStudent ? teacherId : studentId}`,
                                            message_content: message, // Assuming the latest message is available in the list
                                            timestamp: new Date().toISOString(),

                                        }
                                 await sendNotifToTopic(userTopic,msgHeading, data.message_content, data);
     
                                // await sendNotif(token, "New Message", `You have received a new message`,data);
                            

            } catch (error) {
                handleError('sending message', error);
            }
        });
       socket.on('mark as read', async(data) => {
            
            try {
                const { teacherId, studentId, isStudent,chatType = 'teacher_student' } = data;

                    await executeTransaction('mark_as_read', [teacherId, studentId, isStudent, chatType]);
        
            } catch (error) {
                handleError('retrieving chat history', error);
            }
          
        });


        socket.on('leave conversation', async({ teacherId, studentId, isStudent, chatType = 'teacher_student' }) => {
            let id;
            isStudent ? id = studentId : id = teacherId
            leaveRoom(getConversationId(teacherId, studentId,chatType));
            if (chatType === 'teacher_student') {
            const listId = getListId(id, isStudent,chatType);

            [teacherId, studentId] = isStudent ? [0, id] : [id, 0];
            const sender = isStudent ? 'student' : 'teacher';

            const list = await executeTransaction('Get_Calls_And_Chats_List', ['chat', sender, teacherId, studentId]);
            io.to(listId).emit('chat list', list);
            }
        });

        socket.on('disconnect', () => {
            console.log('A user disconnected');
        });
    });
}

module.exports = initializeTeacherChat;


