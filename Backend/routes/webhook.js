var express = require('express');
var router = express.Router();
const emailLog = require('../models/email_log');

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const studentModel = require('../models/student');
const db = require('../config/dbconnection');
const { sendLeadWelcomeEmail } = require('../helpers/lead-welcome-helper');

// Ping test for connectivity
router.get('/brevo', (req, res) => {
    res.json({ status: "Webhook is alive", time: new Date().toISOString() });
});

// Brevo Webhook Handler
router.post('/brevo', async (req, res) => {
    try {
        let payloads = req.body;
        
        // Handle both single objects and arrays of payloads
        if (!Array.isArray(payloads)) {
            payloads = [payloads];
        }

        console.log(`Received ${payloads.length} payload(s) from Brevo`);

        for (const payload of payloads) {
            // Log to scratch folder for guaranteed write access and visibility
            try {
                const logMsg = `[${new Date().toISOString()}] Payload: ${JSON.stringify(payload)}\n`;
                // Try multiple locations just in case
                fs.appendFileSync(path.join(__dirname, '../webhook_debug.log'), logMsg);
                fs.appendFileSync(path.join(__dirname, '../../scratch/webhook_hits.log'), logMsg);
            } catch (logError) {
                console.error('Failed to write to logs:', logError.message);
            }
            
            const event = (payload.event || '').toLowerCase();

            // Brevo sends message-id in various field names; try all variations
            let messageId = payload['message-id'] || 
                            payload['messageId'] || 
                            payload['message_id'] || 
                            payload['Message-Id'] || 
                            payload['Message-ID'] ||
                            (payload.metadata && (payload.metadata['message-id'] || payload.metadata['messageId']));

            // Brevo transactional webhooks often use "Message-Id" as a header in the payload
            // Some Brevo accounts send the message id directly as the 'id' field
            if (!messageId) {
                messageId = payload['id'] || payload['MessageId'] || null;
            }

            console.log(`Processing Brevo event: "${event}" for messageId: ${messageId}`);
            console.log(`Full payload keys: ${Object.keys(payload).join(', ')}`);

            // All open/click event names Brevo may send
            const openEvents = [
                'opened', 'open', 'first_opening', 'firstopening', 'fisrtopening', 
                'unique_opened', 'proxy_open', 'click', 'clicked', 'first_open',
                'opened_unique', 'opening', 'uniqueopened'
            ];

            if (openEvents.includes(event) && messageId) {
                console.log(`✅ Email opened/clicked detected (${event}) for messageId: ${messageId}`);
                
                // Strip angle brackets for clean ID
                const cleanId = messageId.replace(/^<|>$/g, '');
                const bracketId = cleanId.startsWith('<') ? cleanId : `<${cleanId}>`;

                console.log(`Updating Opened_At for clean ID: ${cleanId} and bracketed ID: <${cleanId}>`);
                await emailLog.Update_Email_Opened(cleanId);
                await emailLog.Update_Email_Opened(`<${cleanId}>`);
            } else if (openEvents.includes(event) && !messageId) {
                // No messageId — try to update by email address as fallback
                const recipientEmail = payload['email'] || payload['to'] || payload['recipient'];
                console.warn(`⚠️ Open event received but no message-id found. Recipient: ${recipientEmail}. Cannot update without message-id.`);
            } else {
                console.log(`Email event: "${event}" for messageId: ${messageId} (No action taken for this event type)`);
            }
        }

        res.status(200).json({ success: true });
    } catch (error) {
        try {
            const errLog = `[${new Date().toISOString()}] Error: ${error.message}\n`;
            fs.appendFileSync(path.join(__dirname, '../../scratch/webhook_hits.log'), errLog);
        } catch (logError) {}
        console.error('Brevo Webhook error:', error);
        res.status(200).json({ success: false, error: error.message }); // Always return 200 to Brevo
    }
});

/**
 * Helper to process inbound email replies from leads
 */
async function processInboundEmailReply({ fromEmail, subject = '', text = '', html = '', rawPayload = {} }) {
    try {
        const cleanEmail = (fromEmail || '').trim().toLowerCase();
        if (!cleanEmail) {
            console.warn('[EMAIL REPLY] Ignored: No sender email found in payload.');
            return { success: false, message: 'Missing sender email' };
        }

        console.log(`[EMAIL REPLY] Processing incoming reply from ${cleanEmail}...`);

        // 1. Find lead in student table by email (prioritize active, fallback if any)
        const [students] = await db.promise().query(
            `SELECT Student_ID, First_Name, Last_Name, Email, Phone_Number 
             FROM student 
             WHERE LOWER(TRIM(Email)) = LOWER(TRIM(?)) 
             ORDER BY CASE WHEN (Delete_Status = 0 OR Delete_Status IS NULL) THEN 0 ELSE 1 END ASC, Student_ID DESC LIMIT 1`,
            [cleanEmail]
        );

        if (students.length === 0) {
            console.warn(`[EMAIL REPLY] No student found for email ${cleanEmail}. Skipping.`);
            return { success: false, message: `Lead not found for email ${cleanEmail}` };
        }

        const student = students[0];
        const studentId = student.Student_ID;
        const studentName = `${student.First_Name || ''} ${student.Last_Name || ''}`.trim();
        const studentPhone = student.Phone_Number || '';

        // 2. Determine user's intent from text/subject
        const combinedContent = `${subject} ${text} ${html}`.toLowerCase();
        
        // Negative indicators
        const negativeKeywords = [
            'not interested', 'no thank', 'dont want', "don't want", 'stop', 
            'unsubscribe', 'not looking', 'remove', 'cancel', 'no need', 'not required'
        ];
        const isNotInterested = negativeKeywords.some(kw => combinedContent.includes(kw));

        // Positive indicators
        const positiveKeywords = [
            'interested', 'yes', 'call me', 'want to join', 'details', 'fees', 
            'schedule', 'timing', 'batch', 'offline', 'online', 'pte', 'ielts', 
            'oet', 'contact me', 'admission', 'course', 'joining', 'join'
        ];
        const isInterested = positiveKeywords.some(kw => combinedContent.includes(kw));

        let choice = 'Interested';
        if (isNotInterested) {
            choice = 'Not Interested';
        } else if (isInterested) {
            choice = 'Interested';
        } else {
            // General reply to welcome email defaults to Interested
            choice = 'Interested';
        }

        const replySummary = text ? text.trim().slice(0, 500) : (subject ? subject.trim().slice(0, 200) : 'Lead replied via email');
        const commentText = `[Email Reply: ${choice}] ${replySummary}`;

        // 3. Save or update lead_response table
        const rawJson = JSON.stringify({
            source: 'email_reply',
            from: cleanEmail,
            subject,
            text: replySummary,
            recordedAt: new Date().toISOString(),
            payload: rawPayload
        });

        const [existing] = await db.promise().query(
            `SELECT Response_ID FROM lead_response 
             WHERE Student_ID = ? AND (Delete_Status = 0 OR Delete_Status IS NULL) 
             LIMIT 1`,
            [studentId]
        );

        if (existing.length > 0) {
            await db.promise().query(
                `UPDATE lead_response 
                 SET Response_Choice = ?, Interested_Course = ?, Comments = ?, Raw_Response = ?, Submitted_At = NOW() 
                 WHERE Response_ID = ?`,
                [choice, choice, commentText, rawJson, existing[0].Response_ID]
            );
        } else {
            await db.promise().query(
                `INSERT INTO lead_response 
                 (Student_ID, Email, Full_Name, Phone_Number, Response_Choice, Interested_Course, Comments, Raw_Response, Submitted_At) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [studentId, cleanEmail, studentName, studentPhone, choice, choice, commentText, rawJson]
            );
        }

        // 4. Update student remark in student table
        const updateRemark = `[EMAIL REPLY: ${choice.toUpperCase()}] ${replySummary.slice(0, 150)}`;
        await db.promise().query(
            `UPDATE student 
             SET Remark = CASE 
                 WHEN Remark IS NULL OR TRIM(Remark) = '' THEN ? 
                 ELSE CONCAT(?, '\n', Remark) 
             END 
             WHERE Student_ID = ?`,
            [updateRemark, updateRemark, studentId]
        );

        // 5. Add to student_followup table
        const [followups] = await db.promise().query(
            `SELECT Follow_Up_ID, Branch_ID, Branch_Name, Department_ID, Department_Name, Assigned_Staff_ID, Assigned_Staff_Name 
             FROM student_followup 
             WHERE Student_ID = ? AND (Delete_Status = 0 OR Delete_Status IS NULL) 
             ORDER BY Follow_Up_ID DESC LIMIT 1`,
            [studentId]
        );

        const latestFu = followups.length > 0 ? followups[0] : {};
        const statusName = choice === 'Interested' ? 'Interested' : 'Not Interested';

        await db.promise().query(
            `INSERT INTO student_followup 
             (Student_ID, Branch_ID, Branch_Name, Department_ID, Department_Name, Assigned_Staff_ID, Assigned_Staff_Name, Follow_Up_Status_ID, Follow_Up_Status_Name, Next_Follow_Up_Date, Remark, Created_Date, Created_By, Delete_Status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 11, ?, NULL, ?, NOW(), 0, 0)`,
            [
                studentId,
                latestFu.Branch_ID || 0,
                latestFu.Branch_Name || '',
                latestFu.Department_ID || 0,
                latestFu.Department_Name || '',
                latestFu.Assigned_Staff_ID || null,
                latestFu.Assigned_Staff_Name || '',
                statusName,
                `Lead replied via email: "${replySummary.slice(0, 200)}" (Choice: ${choice})`
            ]
        );

        console.log(`[EMAIL REPLY] ✅ Successfully processed email reply from ${cleanEmail} (Student ID ${studentId}): ${choice}`);
        return { success: true, studentId, choice };

    } catch (err) {
        console.error('[EMAIL REPLY] Error processing email reply:', err);
        return { success: false, error: err.message };
    }
}

// Inbound Email Webhook Handlers (Brevo, SendGrid, Mailgun, or direct)
router.post('/email-reply', async (req, res) => {
    try {
        const body = req.body || {};
        console.log('[WEBHOOK EMAIL-REPLY] Incoming payload keys:', Object.keys(body));

        let processed = 0;

        // 1. Brevo inbound email format: body.items = [ { From: { Address }, Subject, RawTextContent } ]
        if (Array.isArray(body.items)) {
            for (const item of body.items) {
                const fromEmail = item.From?.Address || item.Sender || item.from || '';
                const subject = item.Subject || '';
                const text = item.RawTextContent || item.ExtractedMarkdownMessage || item.Text || '';
                const html = item.RawHtmlContent || '';
                await processInboundEmailReply({ fromEmail, subject, text, html, rawPayload: item });
                processed++;
            }
        } else {
            // 2. Standard format (SendGrid, Mailgun, Postmark, or generic HTTP POST)
            const fromEmail = body.from || body.sender || body['from_email'] || body.From || body.email || '';
            const subject = body.subject || body.Subject || '';
            const text = body.text || body.content || body['stripped-text'] || body.body || '';
            const html = body.html || '';
            await processInboundEmailReply({ fromEmail, subject, text, html, rawPayload: body });
            processed++;
        }

        res.json({ success: true, processed });
    } catch (err) {
        console.error('[WEBHOOK EMAIL-REPLY] Error:', err.message);
        res.status(200).json({ success: false, error: err.message });
    }
});

// Alias for Brevo inbound webhook
router.post('/brevo-inbound', (req, res, next) => {
    req.url = '/email-reply';
    router.handle(req, res, next);
});




// --- Facebook Lead Ads Webhook ---

// Facebook Webhook Verification (GET)
// Meta sends a GET request to verify this endpoint
router.get('/facebook', (req, res) => {
    const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Add logging to see if Meta is actually hitting this endpoint
    const logMsg = `[${new Date().toISOString()}] VERIFICATION ATTEMPT: mode=${mode}, token=${token}, challenge=${challenge}\n`;
    fs.appendFileSync(path.join(__dirname, '../facebook_debug.log'), logMsg);

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('FACEBOOK WEBHOOK VERIFIED');
            res.status(200).send(challenge);
        } else {
            const failMsg = `[${new Date().toISOString()}] VERIFICATION FAILED: Token mismatch. Expected ${VERIFY_TOKEN}, got ${token}\n`;
            fs.appendFileSync(path.join(__dirname, '../facebook_debug.log'), failMsg);
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

// Facebook Lead Notification (POST)
// Meta sends a POST request when a new lead is created
router.post('/facebook', async (req, res) => {
    try {
        const body = req.body;
        // Immediate log to see what we received
        fs.appendFileSync(path.join(__dirname, '../facebook_debug.log'), `[${new Date().toISOString()}] RAW BODY: ${JSON.stringify(body)}\n`);

        if (body.object === 'page') {

            for (const entry of body.entry) {
                if (entry.changes) {
                    for (const change of entry.changes) {
                        if (change.field === 'leadgen') {
                            const leadgenId = change.value.leadgen_id;
                            const pageId = change.value.page_id;
                            console.log(`New lead notification from Facebook: leadgen_id=${leadgenId}, page_id=${pageId}`);
                            
                            // Process lead asynchronously
                            processFacebookLead(leadgenId).catch(err => {
                                console.error('Error processing Facebook lead:', err);
                            });
                        }
                    }
                }
            }
            res.status(200).send('EVENT_RECEIVED');
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('Facebook Webhook POST error:', error);
        res.status(500).send('INTERNAL_ERROR');
    }
});

/**
 * Fetches lead details from Facebook Graph API and saves to database
 */
async function processFacebookLead(leadgenId) {
    try {
        const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
        if (!PAGE_ACCESS_TOKEN || PAGE_ACCESS_TOKEN === 'YOUR_PAGE_ACCESS_TOKEN_HERE') {
            console.error('FB_PAGE_ACCESS_TOKEN is not configured');
            return;
        }

        // 1. Fetch lead data from Facebook
        const response = await axios.get(`https://graph.facebook.com/v18.0/${leadgenId}?access_token=${PAGE_ACCESS_TOKEN}`);
        const leadData = response.data;
        
        console.log('Fetched lead data from FB:', JSON.stringify(leadData));

        // 2. Map Facebook fields to our Student model format
        // Lead Ads forms usually have standard field names or custom labels
        const fields = leadData.field_data || [];
        
        const getFieldValue = (name) => {
            const field = fields.find(f => f.name === name);
            return field ? field.values[0] : null;
        };

        // Standard Facebook lead field names: 'full_name', 'email', 'phone_number'
        const fullName = getFieldValue('full_name') || '';
        const email = getFieldValue('email') || '';
        const phone = getFieldValue('phone_number') || '';
        
        // Split name into First and Last
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0] || 'FB Lead';
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : leadgenId;

        // 3. Prepare student object for database
        const studentObj = {
            Student_ID: 0, // New student
            First_Name: firstName,
            Last_Name: lastName,
            Email: email,
            Phone_Number: phone,
            Remark: `Lead from Facebook Ads (ID: ${leadgenId})`,
            Enquiry_Source_Id: 3, // ID 3 is "Facebook" in your database
            Created_By: 1, // System user ID
            Active_Status: 'Active',
            Delete_Status: 0,
            Branch_Id: null,
            Assigned_Staff_ID: null
        };

        // Log the mapped object for debugging
        fs.appendFileSync(path.join(__dirname, '../facebook_debug.log'), `[${new Date().toISOString()}] Saving Lead: ${JSON.stringify(studentObj)}\n`);

        console.log('Saving Facebook lead to database:', studentObj);

        // 4. Save to database using existing model
        const result = await studentModel.Save_student(studentObj);
        fs.appendFileSync(path.join(__dirname, '../facebook_debug.log'), `[${new Date().toISOString()}] DB Success: ${JSON.stringify(result)}\n`);
        console.log('Facebook lead saved successfully. DB Result:', result);


    } catch (error) {
        console.error(`Failed to process Facebook lead ${leadgenId}:`, error.response?.data || error.message);
        throw error;
    }
}


// --- Excel to CRM Webhook ---
router.post('/excel-lead', async (req, res, next) => {
    try {
        const payload = req.body;
        
        // Log the received payload for debugging
        const logMsg = `[${new Date().toISOString()}] EXCEL LEAD PAYLOAD: ${JSON.stringify(payload)}\n`;
        fs.appendFileSync(path.join(__dirname, '../webhook_debug.log'), logMsg);

        // Extract basic data (supporting all old, new, and alternate key variations)
        const name = payload['full_name'] || payload['Name'] || payload['name'] || payload['Full_Name'] || payload['Full Name'] || '';
        const email = payload['email'] || payload['Email'] || payload['Email Address'] || payload['email_address'] || '';
        const phone = payload['phone_number'] || payload['Phone Number'] || payload['Phone_Number'] || payload['Phone'] || payload['phone'] || payload['contact'] || payload['Contact'] || payload['mobile'] || payload['Mobile'] || '';
        const city = payload['city'] || payload['City'] || payload['location'] || payload['Location'] || '';
        const pteCoaching = payload['are_you_interested_in_pte_coaching?'] || payload['are_you_interested_in_pte_coaching'] || payload['pte_coaching'] || payload['PTE'] || '';
        const campaignNumber = payload['Campaign Number'] || payload['Campaign_Number'] || payload['campaign_number'] || payload['campaign'] || payload['Campaign'] || '';

        // Clean values to string format
        const cleanName = name !== undefined && name !== null ? String(name).trim() : '';
        const cleanEmail = email !== undefined && email !== null ? String(email).trim() : '';
        const cleanPhone = phone !== undefined && phone !== null ? String(phone).trim() : '';

        // Build remark string with extra details
        let remark = '';
        if (city) remark += `City: ${city}\n`;
        if (pteCoaching) remark += `Interested in PTE: ${pteCoaching}\n`;
        if (campaignNumber) remark += `Campaign Number: ${campaignNumber}\n`;

        // UPDATE FALLBACK: If lead exists with matching name and empty phone number, update it instead of duplicating
        if (cleanName && cleanPhone) {
            const [existingLeads] = await db.promise().query(
                `SELECT Student_ID FROM student 
                 WHERE LOWER(TRIM(First_Name)) = LOWER(TRIM(?)) 
                   AND (Phone_Number IS NULL OR TRIM(Phone_Number) = '') 
                   AND Enquiry_Source_Id = 3 
                   AND (Delete_Status = 0 OR Delete_Status IS NULL) 
                 ORDER BY Student_ID DESC LIMIT 1`,
                [cleanName]
            );

            if (existingLeads.length > 0) {
                const existingId = existingLeads[0].Student_ID;
                console.log(`[DEBUG] Updating existing lead (ID: ${existingId}) with Phone_Number: ${cleanPhone}`);
                await db.promise().query(
                    `UPDATE student SET Phone_Number = ?, Email = CASE WHEN ? <> '' THEN ? ELSE Email END WHERE Student_ID = ?`,
                    [cleanPhone, cleanEmail, cleanEmail, existingId]
                );
                return res.json({ success: true, message: 'Existing lead updated with phone number', studentId: existingId });
            }
        }

        // Default to unassigned
        let assignedStaffId = null;
        let assignedStaffName = '';

        // Campaign-Based Round Robin Logic with Fallback to Campaign 0
        let targetCampaignNumber = campaignNumber;
        let campaigns = [];
        let isFallback = false;

        try {
            // First attempt: try to find the campaign provided
            if (targetCampaignNumber) {
                [campaigns] = await db.promise().query(
                    'SELECT Campaign_ID, Campaign_Name, Last_Assigned_Index FROM campaign WHERE Campaign_Number = ? AND (Delete_Status = 0 OR Delete_Status IS NULL) LIMIT 1',
                    [targetCampaignNumber]
                );
            }

            // Fallback attempt: if no campaign provided or not found, use Campaign 0
            if (!targetCampaignNumber || campaigns.length === 0) {
                targetCampaignNumber = '0';
                isFallback = true;
                [campaigns] = await db.promise().query(
                    'SELECT Campaign_ID, Campaign_Name, Last_Assigned_Index FROM campaign WHERE Campaign_Number = ? AND (Delete_Status = 0 OR Delete_Status IS NULL) LIMIT 1',
                    [targetCampaignNumber]
                );
            }

            console.log(`[DEBUG] Excel Campaign: '${campaignNumber}' | Fallback Used: ${isFallback} | Target Campaign: '${targetCampaignNumber}'`);

            if (campaigns.length > 0) {
                const campaign = campaigns[0];
                console.log(`[DEBUG] Found Campaign: '${campaign.Campaign_Name}' (ID: ${campaign.Campaign_ID})`);
                
                // Fetch assigned users, ordered by User_ID to ensure deterministic rotation
                // Note: User_Active_Status may be null for active users — treat null as active
                const [users] = await db.promise().query(
                    `SELECT u.User_ID, CONCAT(u.First_Name, ' ', IFNULL(u.Last_Name, '')) as User_Name 
                     FROM campaign_user cu
                     JOIN users u ON cu.User_ID = u.User_ID
                     WHERE cu.Campaign_ID = ? 
                       AND (u.Delete_Status = 0 OR u.Delete_Status IS NULL)
                       AND (u.User_Active_Status IS NULL OR u.User_Active_Status = 1)
                     ORDER BY cu.User_ID ASC`,
                    [campaign.Campaign_ID]
                );
                
                if (users.length > 0) {
                    console.log(`[DEBUG] Available Staff: ${users.map(u => u.User_Name).join(', ')}`);
                    let lastIndex = campaign.Last_Assigned_Index !== null ? campaign.Last_Assigned_Index : -1;
                    let nextIndex = (lastIndex + 1) % users.length;
                    
                    const assignedUser = users[nextIndex];
                    assignedStaffId = assignedUser.User_ID;
                    assignedStaffName = assignedUser.User_Name.trim();
                    
                    // Update Last_Assigned_Index in DB
                    await db.promise().query(
                        'UPDATE campaign SET Last_Assigned_Index = ? WHERE Campaign_ID = ?',
                        [nextIndex, campaign.Campaign_ID]
                    );
                    console.log(`[DEBUG] ✅ Lead assigned to: ${assignedStaffName} (ID: ${assignedStaffId})`);
                } else {
                    console.log(`[DEBUG] ❌ No active users configured for Campaign '${targetCampaignNumber}'. Lead left unassigned.`);
                }
            } else {
                console.log(`[DEBUG] ❌ CRITICAL: Default Campaign 0 not found in database! Lead left unassigned.`);
            }
        } catch (err) {
            console.error('[DEBUG] ❌ Error processing campaign round robin assignment:', err);
        }

        const studentData = {
            Student_ID: 0,
            First_Name: cleanName,
            Last_Name: '',
            Phone_Number: cleanPhone,
            Email: cleanEmail,
            Enquiry_Source_Id: 3, // Facebook / Excel
            Assigned_Staff_ID: assignedStaffId,
            Assigned_Staff_Name: assignedStaffName,
            Follow_Up_Status_ID: 11,
            Follow_Up_Status_Name: 'New',
            Remark: remark.trim()
        };

        const rows = await studentModel.Save_student(studentData);
        
        let newStudentId = 0;
        if (rows && rows.length > 0 && rows[0].Student_ID) {
            newStudentId = rows[0].Student_ID;
        } else if (rows && rows[0] && rows[0][0] && rows[0][0].Student_ID) {
            // fallback in case of different MySQL return format
            newStudentId = rows[0][0].Student_ID;
        }

        if (newStudentId > 0) {
            const followupData = {
                Follow_Up_ID: 0,
                Student_ID: newStudentId,
                Branch_ID: 0,
                Branch_Name: '',
                Department_ID: 0,
                Department_Name: '',
                Assigned_Staff_ID: assignedStaffId,
                Assigned_Staff_Name: assignedStaffName,
                Follow_Up_Status_ID: 11,
                Follow_Up_Status_Name: 'New',
                Next_Follow_Up_Date: null,
                Remark: remark.trim(),
                Created_Date: new Date().toISOString().slice(0, 19).replace('T', ' '),
                Created_By: 0,
                Delete_Status: 0
            };
            await studentModel.Save_student_followup(followupData);
        }

        // Send welcome email if this is a newly created lead with an email
        const isNewStudent = (rows && rows[0] && rows[0].existingUser === 0);
        if (newStudentId > 0 && isNewStudent && cleanEmail) {
            sendLeadWelcomeEmail({
                studentId: newStudentId,
                name: cleanName,
                email: cleanEmail,
                phone: cleanPhone,
                req: req
            }).catch(err => console.error('[Webhook Excel Lead] Welcome email error:', err));
        }

        res.json({ success: true, message: 'Lead synchronized successfully', data: rows });
    } catch (e) {
        console.error('Webhook Excel Lead Error: ', e);
        res.status(500).json({ success: false, message: 'Failed to sync lead', error: e.message });
    }
});

module.exports = router;
