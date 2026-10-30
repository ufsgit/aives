require('dotenv').config();
const http2 = require('http2');
const fs = require('fs');
const path = require('path');
const jwts = require('jsonwebtoken');

global.apnsJwtToken = null;

// const FCM = require('fcm-node')
    
// var serverKey = require('../breffini-app-firebase-adminsdk-dzxda-ca2f1a6c2b.json');

// var fcm = new FCM(serverKey)

// module.exports = fcm;

const admin = require("firebase-admin");

function loadServiceAccount() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const rawPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() ||
    (rawJson && !rawJson.startsWith('{') ? rawJson : '');

  if (rawJson && rawJson.startsWith('{')) {
    return JSON.parse(rawJson);
  }

  if (rawPath) {
    const normalizedPath = rawPath.replace(/^['"]|['"]$/g, '');
    const candidatePaths = [
      path.resolve(process.cwd(), normalizedPath),
      path.resolve(__dirname, normalizedPath),
      path.resolve(__dirname, '..', normalizedPath),
    ];

    const existingPath = candidatePaths.find((candidate) => fs.existsSync(candidate));
    if (!existingPath) {
      throw new Error(
        `Firebase service account file not found. Checked: ${candidatePaths.join(', ')}`
      );
    }

    return JSON.parse(fs.readFileSync(existingPath, 'utf8'));
  }

  throw new Error(
    'Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH in backend/.env.'
  );
}

const serviceAccount = loadServiceAccount();
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const sendNotif = async (token, title, body, data) => {
  try {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid FCM token provided');
    }
    const message = {
      notification: {
        title: title,
        body: body,
      },
      data:data,
      
      token: token,
    };
    // const response = await admin.messaging().send(message);
    console.log("Successfully sent message:", response);
  } catch (error) {
    console.error("Error sending message:", error.message);
    throw error;
  }
};


const subscribeToTopic = async (token, topic) => {
  try {
    await admin.messaging().subscribeToTopic(token, topic);
    console.log(`Successfully subscribed to topic: ${topic}`);
  } catch (error) {
    console.error("Error subscribing to topic:", error.message);
    throw error;
  }
};
const unsubscribeFromTopic = async (token, topic) => {
  try {
    await admin.messaging().unsubscribeFromTopic(token, topic);
    console.log(`Successfully unsubscribed from topic: ${topic}`);
  } catch (error) {
    console.error("Error unsubscribing from topic:", error.message);
    throw error;
  }
};


const sendNotifToTopic = async (topic, title, body, data, retries = 3, delayMs = 1000, pushType = "alert") => {
  const sendWithRetry = async (attempt = 1) => {
    try {
      const message = {
        notification: { title, body }, 
        data, 
        topic,
        android: {
          priority: "high",
          ttl: 3600 * 1000, // 1 hour 
          notification: {
            click_action: "FLUTTER_NOTIFICATION_CLICK",
            priority: "max",
            visibility: "public" 

          }, 
          direct_boot_ok: true, 
        },
        apns: { 
          headers: {
            "apns-priority": "10", // High priority
            "apns-push-type": pushType, // "alert" for normal push, "voip" for VoIP calls
            "apns-expiration": String(Math.floor(Date.now() / 1000) + 3600),
          },
          payload: {
            aps: pushType === "voip"
              ? {
                  "content-available": 1, // Required for VoIP
                  category: "NOTIFICATION_CATEGORY",
                  priority: 10,
                }
              : {
                  alert: {
                    title: title,
                    body: body, 
                  },
                  "content-available": 1,
                  sound: "default",
                  badge: 1, 
                },
          }, 
        },
      };     

      const response = await admin.messaging().send(message);
      console.log(`✅ Notification sent successfully to topic: ${topic}`, response);
      return response; 
    } catch (error) {
      if (attempt < retries) {
        console.warn(`⚠️ Retry attempt ${attempt} for topic ${topic}. Error: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
        return sendWithRetry(attempt + 1);
      }

      console.error(`❌ Failed to send notification to topic ${topic} after ${retries} attempts:`, error);
      throw error;
    }
  };  

  return sendWithRetry();
};
const generateJwtToken = () => {
  
  const TEAM_ID = process.env.APPLE_TEAM_ID;
  const KEY_ID = process.env.APPLE_KEY_ID;
  const PRIVATE_KEY = fs.readFileSync(process.env.APPLE_PRIVATE_KEY_PATH, "utf8");

  console.log('TEAM_ID:', TEAM_ID);
  console.log('KEY_ID:', KEY_ID);
  console.log('PRIVATE_KEY_PATH:', process.env.APPLE_PRIVATE_KEY_PATH);

  const jwtToken = jwts.sign(
    { 
      iss: TEAM_ID,
      iat: Math.floor(Date.now() / 1000)
    }, 
    PRIVATE_KEY, 
    {
      algorithm: "ES256",
      header: { 
        alg: "ES256",
        kid: KEY_ID,

      },
      expiresIn: "1h" 
    }
  ); 

  global.apnsJwtToken = jwtToken;
  console.log('Generated JWT:', jwtToken);

  return jwtToken;
};

const getJwtToken = () => {
  if (!global.apnsJwtToken) {
    console.log('token: ', "not available");

    return generateJwtToken();
  }else{
    console.log('token: ', " available");

    return global.apnsJwtToken;
  }
};

const sendAppleNotification = async (deviceToken, title, body, extraData, retryAttempt = 0) => {
  const APNS_TOPIC = extraData.extra.Is_Student_Called==1 ? process.env.APPLE_BUNDLE_ID_STAFF : process.env.APPLE_BUNDLE_ID_STUDENT;

  try {
    console.log('extraData: ', extraData);
    
    const jwtToken = getJwtToken();

    console.log('Generated JWT Token:', jwtToken);

    const apnsUrl = "https://api.push.apple.com:443";
    const DevapnsUrl = "https://api.development.push.apple.com";
    const client = http2.connect(DevapnsUrl, { rejectUnauthorized: false });

    const headers = {
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      "authorization": `bearer ${jwtToken}`,
      "apns-topic": APNS_TOPIC,
      "apns-push-type": "voip",
      "apns-priority": "10",
      "apns-expiration": "0",
      "content-type": "application/json"
    };

    const payload = JSON.stringify({
      aps: {
        alert: {
          title: title,
          body: body
        },
        "sound":"default",
        "content-available":1
      },
      ...extraData
    });
    console.log('payload', payload);

    return new Promise((resolve, reject) => {
      const request = client.request(headers);
      request.write(payload);
      request.end();

      request.on("response", (headers, flags) => {
        const statusCode = headers[":status"];

        console.log("Response Status:", headers[":status"]);
        let data = "";
        request.on("data", (chunk) => {
          data += chunk;
        });
        request.on("end", () => {
          client.close();
          console.log("status code **** "+statusCode);

            if (statusCode === 403 && retryAttempt<1) {
              console.log("Got 403 response, regenerating token and retrying...");
              generateJwtToken();
              sendAppleNotification(deviceToken, title, body, extraData,retryAttempt+1)
                .then(resolve)
                .catch(reject);
              resolve();
            } else {
              resolve();
            }
        });
      });

      request.on("error", (err) => {
        console.error("Error Sending APNs Push:", err.message);
        client.close();
        reject(err);
      });
    });
  } catch (error) {
    console.error("Error in sendAppleNotification:", error);
    throw error;
  }
};


// Update the exports
module.exports = {
  sendNotifToTopic,
  subscribeToTopic,
  unsubscribeFromTopic,
  sendNotif,
  sendAppleNotification
};
