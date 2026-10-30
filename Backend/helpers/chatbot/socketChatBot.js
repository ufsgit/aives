require('dotenv').config();
const nlp = require('compromise');
const { getmultipleSP, executeTransaction } = require('../sp-caller');

const OpenAI = require('openai');
const fuzzball = require('fuzzball');
const openai = new OpenAI({
     apiKey: process.env.OPENAI_ACCESS_TOKEN
    });
const { NlpManager } = require('node-nlp');

const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../jwt-secret');
const jwtSecret = getJwtSecret();

const manager = new NlpManager({ languages: ['en'] });
manager.load();

const { v4: uuidv4 } = require('uuid');

const fs = require("fs");

// Load intents JSON
const intents = JSON.parse(fs.readFileSync("./helpers/chatbot/intents/course.json", "utf-8"));
//OpenAi
const { GoogleGenerativeAI } = require("@google/generative-ai");
const gemini_api_key = process.env.gemini_api_key;
const googleAI = new GoogleGenerativeAI(gemini_api_key);
const geminiModel = googleAI.getGenerativeModel({
    model: "gemini-1.5-flash",
});

async function fetchCompletion() {
    // const openai = new OpenAI({
    //   apiKey: 'process.env.OPENAI_ACCESS_TOKEN;'  // Replace with your OpenAI API key
    // });
    // const completion = await openai.chat.completions.create({
    //     model: "gpt-4o-mini",
    //     messages: [
    //         { role: "system", content: "You are a helpful assistant." },
    //         {
    //             role: "user",
    //             content: "Write a haiku about recursion in programming.",
    //         },
    //     ],
    // });

    // console.log(completion.choices[0].message);

}

let registrationData = {};
let currentStep = null;
const connectedUsers = new Map(); // To keep track of connected users


function initializeChatBot(io) {
    const chatbotNamespace = io.of('/chatbot');

    chatbotNamespace.use((socket, next) => {
        const authHeader = socket.handshake.headers.authorization;
        console.log('authHeader:Socket ', authHeader);
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            console.log('Token:Socket', token);

            if (token) {
                try {
                    const decoded = jwt.verify(token, jwtSecret);
                    console.log('Decoded token:', decoded);
                    socket.userId = decoded.userId;
                    next();
                } catch (err) {
                    console.error('Token verification failed:', err);
                    next(new Error('Authentication error'));
                }
            } else {
                console.log('No token provided');
                next();
            }
        } else {
            console.log('No authorization header or invalid format');
            next();
        }
    });

    chatbotNamespace.on('connection', (socket) => handleChatbotConnection(socket, connectedUsers));
}


function handleChatbotConnection(socket, connectedUsers) {
    const { userId, isEnrolled } = authenticateUser(socket);

    if (userId) {
        console.log('Authenticated user connected:', userId);
        connectedUsers.set(socket.id, { userId, rooms: new Set(), isAuthenticated: true });
        handleAuthenticatedUser(socket, userId, isEnrolled, connectedUsers);
    } else {
        console.log('Unauthenticated user connected');
        const guestId = `guest_${uuidv4()}`;
        connectedUsers.set(socket.id, { userId: guestId, rooms: new Set(), isAuthenticated: false });
        handleUnauthenticatedUser(socket, guestId, connectedUsers);
    }

    // Implement enhanced disconnect handling
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const user = connectedUsers.get(socket.id);
        if (user) {
            console.log(`User ${user.userId} was in rooms:`, Array.from(user.rooms));

            // Notify all rooms this user was in about the disconnection
            user.rooms.forEach(room => {
                socket.to(room).emit('userDisconnected', { userId: user.userId, isGuest: !user.isAuthenticated });
            });

            // Perform any necessary cleanup
            if (user.isAuthenticated) {
                updateUserStatus(user.userId, 'offline');
            } else {
                removeGuestUser(user.userId);
            }

            // Remove user from our tracking
            connectedUsers.delete(socket.id);
        }

        // Log the total number of connected users
        console.log('Total connected users:', connectedUsers.size);
    });

    // Implement leave room functionality
    socket.on('leave_chatbot', (room) => {
        console.log(`User leaving chatbot. Socket ID: ${socket.id}, Room: ${room}`);

        const user = connectedUsers.get(socket.id);
        if (user) {
            console.log(`User ${user.userId} is leaving all rooms:`, Array.from(user.rooms));

            // Notify all rooms this user was in about the disconnection
            user.rooms.forEach(userRoom => {
                socket.to(userRoom).emit('userDisconnected', { userId: user.userId, isGuest: !user.isAuthenticated });
            });

            // Perform any necessary cleanup
            if (user.isAuthenticated) {
                updateUserStatus(user.userId, 'offline');
            } else {
                removeGuestUser(user.userId);
            }

            // Remove user from our tracking
            connectedUsers.delete(socket.id);
        }

        // Disconnect the socket
        socket.disconnect(true);

        console.log('Total connected users:', connectedUsers.size);
    });
}


//****************************** */  for  auth  between with token and without token

const handleAuthenticatedUser = (socket, userId, isEnrolled, connectedUsers) => {
    const room = `user_${userId}`;
    socket.join(room);
    console.log(`User ${userId} joined room: ${room}`);

    const user = connectedUsers.get(socket.id);
    if (user) {
        user.rooms.add(room);
    }

    // sendBotResponse(socket, room, 'Welcome back! How can I assist you with your course today?');

    socket.on('Chatbot_Question', (data) => {
        console.log(' socket.id:chat ', socket.id);

        console.log(`Received question from user ${userId} in room ${room}:`, data.message);
        handleUserQuestion(socket, room, data, isEnrolled);
    });
};

const handleUnauthenticatedUser = (socket, guestId, connectedUsers) => {
    const room = `guest_${guestId}`;
    socket.join(room);
    console.log(`Guest ${guestId} joined room: ${room}`);

    const user = connectedUsers.get(socket.id);
    if (user) {
        user.rooms.add(room);
    }

    let isRegistrationInitiated = false;
    // sendBotResponse(socket, room, 'Welcome back! How can I assist you ?');

    socket.on('Chatbot_Question', async(data) => {
        console.log(`Received question from guest ${guestId} in room ${room}:`, data.message);
        if (!isRegistrationInitiated) {
            if (data.message) {
                const isRegistrationRequested = data.message.toLowerCase().includes('register');

                if (isRegistrationRequested) {
                    isRegistrationInitiated = true;
                    const registrationResponse = await handleRegistrationStep('');
                    sendBotResponse(socket, room, registrationResponse);
                } else {
                    await processUnauthenticatedUserQuestion(socket, room, data);
                }
            }
        } else {
            const response = await handleRegistrationStep(data.message);
            sendBotResponse(socket, room, response);
        }
    });
};


//****************************** */  for question 
const processUnauthenticatedUserQuestion = async(socket, room, data) => {
    let preprocessedMessage = lemmatize(preprocessText(data.message));
    // if (!containsDomainKeywords(preprocessedMessage)) {
    //   var result = await generate(data.message);  // Fallback to OpenAI
    //   sendBotResponse(socket, room, result);
    //   return;
    // }
    const userMessage = data.message;
    let bestMatch = { score: 0, intent: null, question: null };

    // Iterate over intents and their questions
    for (const intent of intents) {
        for (const question of intent.questions) {
            const score = fuzzball.ratio(userMessage.toLowerCase(), question.toLowerCase());

            // Update the best match if a higher score is found
            if (score > bestMatch.score) {
                bestMatch = { score, intent, question };
            }
        }
    }
    console.log(bestMatch)

    // Define a threshold for fuzzy matching
    const threshold = 50; // Adjust as needed

    if (bestMatch.score >= threshold) {
        console.log(`Matched question: "${bestMatch.question}" with score: ${bestMatch.score}`);
        preprocessedMessage=bestMatch.question
    } 
    console.log('preprocessedMessage: ', preprocessedMessage);
    const response = await manager.process('en', preprocessedMessage);



    if (response.intent.startsWith('pre_purchase_') || response.intent.startsWith('app_related_') || response.intent.startsWith('general_')) {
        sendBotResponse(socket, room, response.answer);

    } else {

const payload=[{
    type:"whatsapp",
    Supporting_Document_Path:'https://wa.me/+918891504777?text=Hello,%20I%20have%20a%20query',
    Content_Name: "Apologies, but I'm unable to provide an answer to this question. Is there anything else I can assist you with regarding our courses or the enrollment process? If you have any doubts, please feel free to message us on WhatsApp: ",
    number:8891504777
}]



        sendBotResponse(
            socket,
            room,
            payload,
            'whatsapp'
        );
            }

};
const handleUserQuestion = async(socket, room, data, isEnrolled) => {
    // let preprocessedMessage = lemmatize(preprocessText(data.message));
    const userMessage = data.message;
    let bestMatch = { score: 0, intent: null, question: null };

    // Iterate over intents and their questions
    for (const intent of intents) {
        for (const question of intent.questions) {
            const score = fuzzball.ratio(userMessage.toLowerCase(), question.toLowerCase());

            // Update the best match if a higher score is found
            if (score > bestMatch.score) {
                bestMatch = { score, intent, question };
            }
        }
    }
    console.log(bestMatch)

    // Define a threshold for fuzzy matching
    const threshold = 50; // Adjust as needed

    if (bestMatch.score >= threshold) {
        console.log(`Matched question: "${bestMatch.question}" with score: ${bestMatch.score}`);
        preprocessedMessage=bestMatch.question
    } else {
                const payload=[{
                    type:"whatsapp",
                    Supporting_Document_Path:'https://wa.me/+918891504777?text=Hello,%20I%20have%20a%20query',
                    Content_Name: "I'm not aware of this. Please contact our support team for assistance",
                    number:8891504777
                            }]
                 sendBotResponse( socket,room, payload,'whatsapp' );
                  return;

        }

    const { userId } = authenticateUser(socket);
    const authHeader = socket.handshake.headers.authorization;
    console.log('authHeader:Socket ', authHeader);

    // Time-based greetings logic
    const currentHour = new Date().getHours();
    const isMorning = currentHour >= 5 && currentHour < 12;
    const isAfternoon = currentHour >= 12 && currentHour < 17;
    const isEvening = currentHour >= 17 && currentHour < 21;
    const isNight = currentHour >= 21 || currentHour < 5;

    // Check for greeting intents
    if (/good\s?morning/i.test(preprocessedMessage)) {
        if (isMorning) {
            sendBotResponse(socket, room, "Good morning! How can I assist you with your course today?");
        } else if (isAfternoon) {
            sendBotResponse(socket, room, "Good afternoon! I think you meant to say good afternoon.");
        } else if (isEvening) {
            sendBotResponse(socket, room, "Good evening! It’s evening now.");
        } else if (isNight) {
            sendBotResponse(socket, room, "It’s quite late! Good night.");
        }
        return;
    }

    if (/good\s?afternoon/i.test(preprocessedMessage)) {
        if (isAfternoon) {
            sendBotResponse(socket, room, "Good afternoon!How can I assist you with your course today?");
        } else {
            sendBotResponse(socket, room, "It’s not afternoon right now, but how can I assist you?");
        }
        return;
    }

    if (/good\s?evening/i.test(preprocessedMessage)) {
        if (isEvening) {
            sendBotResponse(socket, room, "Good evening! How can I assist you with your course today?");
        } else {
            sendBotResponse(socket, room, "It's not evening yet, but feel free to ask anything.");
        }
        return;
    }

    const response = await manager.process('en', preprocessedMessage);
    const confidenceThreshold = 0.6;
 
    console.log('isEnrolled: ', isEnrolled);
    console.log('socket.userId: ', socket.userId);

    console.log('response.intent: ', response.intent);
    console.log('response.score : ', response.score );
    if (response.intent && response.intent !== 'out_of_scope' && response.score > confidenceThreshold) {
        if (response.intent.startsWith('course_material')) {
         
            if (!isEnrolled) {
                            const payload=[{
                                type:"whatsapp",
                                Supporting_Document_Path:'https://wa.me/+918891504777?text=Hello,%20I%20have%20a%20query',
                                Content_Name: "I'm not aware of this. Please contact our support team for assistance",
                                number:8891504777
                            }]
                        sendBotResponse(
                            socket,
                            room,
                            payload,
                            'whatsapp'
                        );
          
                return;
            }

            // Extract material type from intent (e.g., 'writing' from 'request_writing_material')
            const materialType = response.intent.replace('course_material_request_', '').replace('_material', '');
            console.log('materialType: ', materialType);

            try {


                const materials = await getmultipleSP('Get_CourseContent_By_SectionAndStudent', [materialType, userId]);
                console.log('userId: ', userId);
                console.log('materials: ', materials);
                const materialName=materialType.replaceAll('_', ' ').trim();
                if (materials && materials.length > 0) {
                    // const formattedResponse = formatMaterialResponse(materials, response.answer);
                    // console.log('formattedResponse: ', formattedResponse);
                    console.log('materials[0]', materials[0][0]['Course_ID']);
                    if (materials[0][0]['Content_ID'] != null) {
                        sendBotResponse(socket, room, materials[0], 'link');

                    } else {
                        sendBotResponse(socket, room,
                            `I couldn't find any ${materialName} materials In Library at the moment. Please contact your Support Team.`
                        );
                    }
                } else {
                    sendBotResponse(socket, room,
                        `I couldn't find any ${materialName} materials  In Library at the moment. Please contact your Support Team.`
                    );
                }
                return;
            } catch (error) {
                console.error('Error fetching materials:', error);
                sendBotResponse(socket, room,
                    "Unable to access course materials right now. Please try again later."
                );
                return;
            }
        } else if (response.intent.startsWith('pre_purchase_') || (response.intent.startsWith('post_purchase_') || response.intent.startsWith('app_related_') || response.intent.startsWith('general_') && isEnrolled)) {
            sendBotResponse(socket, room, response.answer);
        }  
        
        else if (response.intent === 'None') {
            const payload=[{
                type:"whatsapp",
                Supporting_Document_Path:'https://wa.me/+918891504777?text=Hello,%20I%20have%20a%20query',
                Content_Name: "I'm not aware of this. Please contact our support team for assistance",
                number:8891504777
            }]
            sendBotResponse(
                socket,
                room,
                payload,
                'whatsapp'
            );
            // var result = await generate(data.message);   //akhina told chatgpt not required when client come to office
            // sendBotResponse(socket, room, result);
        }
    } else {

        
        const payload=[{
            type:"whatsapp",
            Supporting_Document_Path:'https://wa.me/+918891504777?text=Hello,%20I%20have%20a%20query',
            Content_Name: "I'm not aware of this. Please contact our support team for assistance",
            number:8891504777
        }]
               

        sendBotResponse(
            socket, 
            room,
            payload,
            'whatsapp'
        );
        // var result = await generate(data.message);
        // sendBotResponse(socket, room, result);
    }
};


//****************************** */
const   sendBotResponse = (socket, room, message, type = 'text') => {
    console.log('message: ', message);
    const payload = type === 'text' ? [{ Content_Name: message }] : message;

    socket.nsp.to(room).emit('Chatbot_Answer', {
        payload,
        sender: 'Server',
        id: uuidv4(),
        type
    });
};



function isValidEmail(email) {
    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

const authenticateUser = (socket) => {
    let isEnrolled = false;

    if (socket.userId) {
        isEnrolled = true;
    }

    return { userId: socket.userId, isEnrolled };
};

function isStrongPassword(password) {
    // Password should be at least 8 characters long and include a mix of letters, numbers, and symbols
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    return passwordRegex.test(password);
}

function updateUserStatus(userId, status) {
    console.log(`Updating user ${userId} status to ${status}`);
    // In a real application, you would update your database here
}

// Mock function to remove a guest user from temporary storage
function removeGuestUser(guestId) {
    console.log(`Removing guest user ${guestId} from temporary storage`);
    // In a real application, you might clear any temporary data associated with this guest
}
const generate = async(question) => {
    try {
        const prompt = question + 'and add with some beatifull emojies in response sentance';
        const result = await geminiModel.generateContent(prompt);
        const response = result.response;
        return response.text();
    } catch (error) {
        console.log("response error", error);
    }
};
const lemmatize = (text) => {
    return nlp(text).normalize().out('text');
};
const preprocessText = (text) => {
    const stopWords = ["what", "is", "the", "of", "a", "an", "to", "in", "for"];

    // Convert to lowercase
    text = text.toLowerCase();

    // Remove punctuation
    text = text.replace(/[^\w\s]/gi, '');

    // Split words and remove stop words
    let words = text.split(" ").filter(word => !stopWords.includes(word));

    // Join the processed words back into a string
    return words.join(" ");
};

const domainKeywords = [
    'course', 'study', 'materials', 'enroll', 'duration', 'fees', 'support',
    'tutor', 'exam', 'practice', 'test', 'schedule', 'price', 'counselor'
];

const containsDomainKeywords = (message) => {
    return domainKeywords.some(keyword => message.includes(keyword));
};




// Helper function to format material response
const formatMaterialResponse = (materials, introMessage) => {
    let response = `${introMessage}\n\n`;

    materials[0].forEach((material, index) => {
        console.log('material: ', material);
        response += `${index + 1}. ${material.Content_Name}\n`;
        // response += `   ${material.description}\n`;
        response += `   Access here: ${material.Supporting_Document_Path}\n\n`;
    });

    response += "Need help with any of these materials? Just ask!";
    return materials[0];
};


async function handleRegistrationStep(userInput) {
    if (currentStep === null) {
        currentStep = 'name';
        return 'Great! Let\'s get you registered. Please enter your full name.';
    } else if (currentStep === 'name') {
        registrationData.name = userInput;
        currentStep = 'email';
        return 'Thank you. Now, please enter your email address.';
    } else if (currentStep === 'email') {
        if (!isValidEmail(userInput)) {
            return 'That doesn\'t look like a valid email address. Please try again.';
        }
        registrationData.email = userInput;
        currentStep = 'password';
        return 'Excellent. Finally, please create a strong password. It should be at least 8 characters long and include a mix of letters, numbers, and symbols.';
    } else if (currentStep === 'password') {
        if (!isStrongPassword(userInput)) {
            return 'That password isn\'t strong enough. Please try again with a stronger password.';
        }
        registrationData.password = userInput;
        currentStep = null;
        // Here you would typically save the user data to a database
        return `Thank you for registering! Your account has been created. You can now log in using your email and password. If you have any questions about our courses, feel free to ask!`;
    }

    return "I'm sorry, there was an error in the registration process. Please try again or contact our support team.";
}




module.exports = initializeChatBot;
