const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const crypto = require('crypto');
const os = require('os');
const db = require('../config/dbconnection');
const emailHelper = require('./email-helper');
const emailLog = require('../models/email_log');

const SECRET_KEY = process.env.jwtSecret || 'briffniKey#52%3^43';

/**
 * Check if URL is an ephemeral/broken tunnel service that drops connection
 */
function isBrokenTunnelUrl(url) {
    if (!url || typeof url !== 'string') return true;
    const lower = url.toLowerCase();
    return lower.includes('lhr.life') ||
           lower.includes('localhost.run') ||
           lower.includes('loca.lt') ||
           lower.includes('ngrok-free.app') ||
           lower.includes('serveo.net');
}

function isPrivateOrLocalHost(host) {
    if (!host || typeof host !== 'string') return true;
    const lower = host.toLowerCase();
    return lower.includes('localhost') ||
           lower.includes('127.0.0.1') ||
           lower.startsWith('10.') ||
           lower.startsWith('192.168.') ||
           lower.startsWith('172.');
}

/**
 * Get reachable base URL for email links so mobile devices & computers can open the form.
 * Supports dynamic production domain detection via incoming request while preserving local support.
 */
function getBaseUrl(req = null) {
    // 1. Explicit configured URL from environment (APP_URL / PUBLIC_API_URL / BACKEND_URL)
    const envUrl = (process.env.APP_URL || process.env.PUBLIC_API_URL || process.env.BACKEND_URL || '').trim().replace(/\/$/, '');
    if (envUrl && !isBrokenTunnelUrl(envUrl)) {
        return envUrl;
    }

    // 2. Dynamic host from incoming HTTP request if available
    if (req) {
        const rawHost = (req.headers && (req.headers['x-forwarded-host'] || req.headers['host'])) ||
                        (typeof req.get === 'function' ? req.get('host') : '');
        const host = String(rawHost || '').trim();

        const rawProto = (req.headers && (req.headers['x-forwarded-proto'] || req.protocol)) || 'http';
        const proto = String(rawProto).split(',')[0].trim();

        if (host && !isBrokenTunnelUrl(host)) {
            return `${proto}://${host}`;
        }
    }

    // 3. Fallback based on NODE_ENV
    if (process.env.NODE_ENV === 'production') {
        return 'https://aiveseduapi.ufstech.co.in';
    }

    const port = process.env.PORT || 3520;
    return `http://localhost:${port}`;
}

/**
 * Dynamically fetch official contact email and phone from branches table or environment
 */
async function getOfficialContactInfo(branchId = null) {
    let email = (process.env.OFFICIAL_EMAIL || process.env.BREVO_SENDER_EMAIL || '').trim();
    let phone = (process.env.OFFICIAL_PHONE || process.env.OFFICIAL_CONTACT_NUMBER || '').trim();

    try {
        if (branchId > 0) {
            const [bRows] = await db.promise().query(
                `SELECT Email, ContactNo, MobileNo FROM branches WHERE Branch_Id = ? AND (Delete_Status = 0 OR Delete_Status IS NULL) LIMIT 1`,
                [branchId]
            );
            if (bRows && bRows.length > 0) {
                if (bRows[0].Email && bRows[0].Email.trim()) email = bRows[0].Email.trim();
                const p = (bRows[0].MobileNo || bRows[0].ContactNo || '').trim();
                if (p) phone = p;
            }
        }

        if (!email || !phone) {
            const [rows] = await db.promise().query(
                `SELECT Email, ContactNo, MobileNo FROM branches WHERE (Delete_Status = 0 OR Delete_Status IS NULL) ORDER BY Branch_Id ASC LIMIT 1`
            );
            if (rows && rows.length > 0) {
                if (!email && rows[0].Email && rows[0].Email.trim()) email = rows[0].Email.trim();
                const p = (rows[0].MobileNo || rows[0].ContactNo || '').trim();
                if (!phone && p) phone = p;
            }
        }
    } catch (err) {
        console.warn('[Contact Info] Error querying branch contact info:', err.message);
    }

    if (!email) email = 'cs.mgr@testprepinenglish.com';
    if (!phone) phone = '+91 79944 43028';

    return { email, phone };
}

/**
 * Generate a deterministic verification token for a student response URL
 */
function generateLeadToken(studentId, email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    return crypto.createHmac('sha256', SECRET_KEY)
        .update(`${studentId}:${cleanEmail}`)
        .digest('hex')
        .slice(0, 32);
}

/**
 * Verify whether the supplied token matches the student ID and email
 */
function verifyLeadToken(studentId, email, token) {
    if (!studentId || !token) return false;
    const expected = generateLeadToken(studentId, email);
    return expected === token;
}

/**
 * Validates email address format
 */
function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim());
}

/**
 * Sends automated welcome email with interactive form & web link to new leads
 */
async function sendLeadWelcomeEmail({ studentId, name, email, phone, req = null, senderEmail = null, senderName = null }) {
    try {
        let cleanEmail = (email || '').trim();
        let cleanName = (name || '').trim();
        let cleanPhone = (phone || '').trim();
        let branchId = null;
        let matchedStudent = null;

        // Dynamically match and verify lead details directly from CRM database
        // Ensures Student_ID, Email, and Name belong to the EXACT same lead record (never another student!)
        if (cleanEmail) {
            try {
                if (studentId > 0) {
                    const [matchedRows] = await db.promise().query(
                        `SELECT Student_ID, First_Name, Last_Name, Email, Phone_Number, Country_Code, Branch_Id 
                         FROM student 
                         WHERE Student_ID = ? AND LOWER(TRIM(Email)) = LOWER(TRIM(?)) AND (Delete_Status = 0 OR Delete_Status IS NULL) 
                         LIMIT 1`,
                        [studentId, cleanEmail]
                    );
                    if (matchedRows && matchedRows.length > 0) {
                        matchedStudent = matchedRows[0];
                    }
                }

                // If not matched by both, find the student who actually owns this email in CRM
                if (!matchedStudent) {
                    const [rowsByEmail] = await db.promise().query(
                        `SELECT Student_ID, First_Name, Last_Name, Email, Phone_Number, Country_Code, Branch_Id 
                         FROM student 
                         WHERE LOWER(TRIM(Email)) = LOWER(TRIM(?)) AND (Delete_Status = 0 OR Delete_Status IS NULL) 
                         ORDER BY Student_ID DESC LIMIT 1`,
                        [cleanEmail]
                    );
                    if (rowsByEmail && rowsByEmail.length > 0) {
                        matchedStudent = rowsByEmail[0];
                    }
                }

                if (matchedStudent) {
                    studentId = matchedStudent.Student_ID;
                    const dbFullName = `${matchedStudent.First_Name || ''} ${matchedStudent.Last_Name || ''}`.trim();
                    if (dbFullName) cleanName = dbFullName;
                    cleanEmail = matchedStudent.Email.trim();
                    if (matchedStudent.Phone_Number) cleanPhone = `${matchedStudent.Country_Code || ''} ${matchedStudent.Phone_Number}`.trim();
                    branchId = matchedStudent.Branch_Id || matchedStudent.Branch_ID || null;
                }
            } catch (dbErr) {
                console.error('[LEAD WELCOME] Error matching student in DB:', dbErr.message);
            }
        } else if (studentId > 0) {
            try {
                const [leadRows] = await db.promise().query(
                    `SELECT Student_ID, First_Name, Last_Name, Email, Phone_Number, Country_Code, Branch_Id 
                     FROM student 
                     WHERE Student_ID = ? AND (Delete_Status = 0 OR Delete_Status IS NULL) 
                     LIMIT 1`,
                    [studentId]
                );
                if (leadRows && leadRows.length > 0) {
                    const lRow = leadRows[0];
                    const dbFullName = `${lRow.First_Name || ''} ${lRow.Last_Name || ''}`.trim();
                    if (dbFullName) cleanName = dbFullName;
                    if (lRow.Email) cleanEmail = lRow.Email.trim();
                    if (!cleanPhone && lRow.Phone_Number) cleanPhone = `${lRow.Country_Code || ''} ${lRow.Phone_Number}`.trim();
                    branchId = lRow.Branch_Id || lRow.Branch_ID || null;
                    matchedStudent = lRow;
                }
            } catch (dbErr) {
                console.error('[LEAD WELCOME] Error retrieving student from DB:', dbErr.message);
            }
        }

        if (!cleanName || cleanName.toLowerCase() === 'valued student' || cleanName.toLowerCase() === 'valued lead') {
            cleanName = 'Student';
        }
        let effectiveSenderEmail = senderEmail || (req && (req.userEmail || (req.body && req.body.Sender_Email))) || null;
        let effectiveSenderName = "TestPerp Aives";

        if (effectiveSenderEmail && (effectiveSenderEmail.toLowerCase() === 'admin_user@g.com' || effectiveSenderEmail.toLowerCase() === 'admin_user')) {
            effectiveSenderEmail = 'cs.mgr@testprepinenglish.com';
        }

        if (!studentId) {
            console.log('[LEAD WELCOME] Skipped: No valid Student_ID provided.');
            return { success: false, reason: 'Missing Student_ID' };
        }

        if (!cleanEmail || !isValidEmail(cleanEmail)) {
            console.log(`[LEAD WELCOME] Skipped for Student ${studentId}: Invalid or missing email address (${cleanEmail}).`);
            return { success: false, reason: 'Invalid email' };
        }

        // 1. Fetch template from DB with fallback so email ALWAYS sends
        let template = null;
        let templateId = null;
        try {
            const [templates] = await db.promise().query(
                `SELECT Template_ID, Template_Name, Subject, Body, Is_Active 
                 FROM email_templates 
                 WHERE (
                     Template_Name = 'Lead Welcome & Response Form'
                     OR Template_Name LIKE '%Lead Welcome%'
                     OR Template_Name LIKE '%Follow-up Email Template%'
                     OR Template_Name = 'Follow-up Email Template'
                 )
                   AND (Delete_Status = 0 OR Delete_Status IS NULL) 
                 ORDER BY (Template_Name = 'Lead Welcome & Response Form') DESC, (Is_Active = 1) DESC, Template_ID DESC
                 LIMIT 1`
            );
            if (templates && templates.length > 0) {
                template = templates[0];
                templateId = template.Template_ID;
            }
        } catch (dbErr) {
            console.error('[LEAD WELCOME] Error fetching email template from DB:', dbErr.message);
        }

        // Built-in fallback template ensuring welcome emails NEVER fail due to missing DB templates
        if (!template) {
            console.log(`[LEAD WELCOME] Database template not found or inactive. Using built-in PTE template for Student ${studentId}.`);
            template = {
                Subject: "Verify Your PTE Academic Enquiry | Aives Australia's TESTPREP",
                Body: "Dear [First Name],\n\nGreetings from Aives Australia's TESTPREP!\n\nThank you for expressing your interest in our PTE Academic Training Programme.\n\nWe have received your enquiry and would like to confirm your genuine interest before connecting you with our Student Admissions Team.\n\nWhy Choose Aives Australia's TESTPREP?\nOur programme is developed under the guidance of qualified Australian immigration law professionals with 20 years of practical experience in understanding English language testing requirements for Australian migration, professional registration, and education pathways.\n\nOur distinctive training approach combines:\n\n• Qualified IELTS/PTE Trainers: Professional training focused on examination techniques, language proficiency, and scoring requirements.\n\n• Expert Guidance & Practical Feedback: Training informed by years of practical experience with English language test preparation, candidate performance, and individual feedback.\n\n• NLP Master Trainers: Additional mindset preparation focusing on confidence, concentration, and examination readiness.\n\n• Practical Mock Tests: Structured mock examinations, performance assessments, and constructive feedback to identify areas requiring improvement.\n\n• Goal-Oriented Training: Preparation aligned with your target PTE score and individual learning needs.\n\nPlease Verify Your Interest\nTo ensure that we provide personalised assistance to genuine prospective students, we kindly request you to verify your enquiry.\n\n[YES, I AM INTERESTED – VERIFY MY ENQUIRY]\n\nBy confirming your interest, you authorise our TESTPREP Student Admissions Team to contact you regarding suitable PTE training options.\n\nOnce verified, our team will be pleased to assist you with the next steps.\n\nDidn't Submit This Enquiry?\n\nIf you did not register an enquiry with us, you may safely disregard this email.\n\nWe look forward to supporting your PTE preparation journey.\n\nWarm regards,\n\nStudent Admissions Team\nAives Australia's TESTPREP\n[Official Email] | [Contact Number]",
                Template_ID: null
            };
        }

        // 2. Prevent rapid duplicate welcome emails for this student (within last 2 minutes)
        try {
            const [existingLogs] = await db.promise().query(
                `SELECT Log_ID, Status FROM email_logs 
                 WHERE ((Student_ID = ? AND ? > 0) OR (LOWER(TRIM(Email_Address)) = LOWER(TRIM(?)) AND ? != ''))
                   AND Sent_At >= NOW() - INTERVAL 2 MINUTE 
                   AND Status = 'Success' 
                 LIMIT 1`,
                [studentId, studentId, cleanEmail, cleanEmail]
            );

            if (existingLogs && existingLogs.length > 0) {
                console.log(`[LEAD WELCOME] Duplicate check: Welcome email already sent recently to Student ID ${studentId} (${cleanEmail}). Skipping.`);
                return { success: true, skipped: true, reason: 'Already sent recently' };
            }
        } catch (logErr) {
            console.warn('[LEAD WELCOME] Warning checking existing email logs:', logErr.message);
        }

        // 3. Construct Secure URLs using reachable host (never localhost)
        // Note: Using email and name as primary identifiers prevents mismatched ID collisions across environments
        const baseUrl = getBaseUrl(req);
        const token = generateLeadToken(studentId, cleanEmail);
        const interestedUrl = `${baseUrl}/lead-response?email=${encodeURIComponent(cleanEmail)}&name=${encodeURIComponent(cleanName)}&token=${token}&choice=Interested`;
        const notInterestedUrl = `${baseUrl}/lead-response?email=${encodeURIComponent(cleanEmail)}&name=${encodeURIComponent(cleanName)}&token=${token}&choice=Not+Interested`;
        const responseFormUrl = `${baseUrl}/lead-response?email=${encodeURIComponent(cleanEmail)}&name=${encodeURIComponent(cleanName)}&token=${token}`;

        // 4. Build Subject and Placeholder Values
        const firstName = cleanName.split(' ')[0] || cleanName || 'Student';
        const contactInfo = await getOfficialContactInfo(branchId);
        const officialEmail = senderEmail || contactInfo.email || 'cs.mgr@testprepinenglish.com';
        const contactNumber = contactInfo.phone || '+91 79944 43028';

        let subject = template?.Subject || "Take the Next Step Towards Your PTE Goal | Aives Australia's TESTPREP";
        subject = subject.replace(/\[First[\s_]*Name\]/gi, firstName)
                         .replace(/\[Student[\s_]*Name\]/gi, cleanName)
                         .replace(/\[Name\]/gi, cleanName)
                         .replace(/\[Email\]/gi, cleanEmail)
                         .replace(/\[Official[\s_]*(?:Email|Mail)(?:[\s_]*Address)?\]/gi, officialEmail)
                         .replace(/\[(?:Official[\s_]*)?(?:Contact|Phone|Mobile)(?:[\s_]*(?:Number|No))?\]/gi, contactNumber);

        // 5. Plain-Text Response Options (No Buttons)
        const responseButtonsHtml = `
            <div style="margin: 20px 0; font-size: 14px; line-height: 1.8;">
                <p style="margin: 0 0 6px 0;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 18px 0 10px 0;">
                        <tr>
                            <td align="left" style="border-radius: 6px; background-color: #003366;">
                                <a href="${interestedUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 6px; background-color: #003366; letter-spacing: 0.5px;">
                                    YES, I AM INTERESTED – VERIFY MY ENQUIRY
                                </a>
                            </td>
                        </tr>
                    </table>
                </p>
                <p style="margin: 0; font-size: 13px; color: #64748b;">
                    <a href="${notInterestedUrl}" target="_blank" style="color: #64748b; text-decoration: underline;">Not Interested / Didn't submit this enquiry</a>
                </p>
            </div>
        `;

        // 6. Assemble email body text and replace dynamic placeholders
        let bodyText = template?.Body || '';

        // Substitute placeholders case-insensitively
        bodyText = bodyText.replace(/\[First[\s_]*Name\]/gi, firstName)
                           .replace(/\[Student[\s_]*Name\]/gi, cleanName)
                           .replace(/\[Lead[\s_]*Name\]/gi, cleanName)
                           .replace(/\[Name\]/gi, cleanName)
                           .replace(/\[Email\]/gi, cleanEmail)
                           .replace(/\[Official[\s_]*(?:Email|Mail)(?:[\s_]*Address)?\]/gi, officialEmail)
                           .replace(/\[(?:Official[\s_]*)?(?:Contact|Phone|Mobile)(?:[\s_]*(?:Number|No))?\]/gi, contactNumber);

        // Remove any old button tables or containers that may exist in saved templates
        bodyText = bodyText
            .replace(/<table[^>]*role="presentation"[^>]*>[\s\S]*?(?:DISCUSS MY PTE TRAINING OPTIONS|OPTIONS|ENQUIRY)[\s\S]*?<\/table>/gi, responseButtonsHtml)
            .replace(/<table[^>]*>[\s\S]*?Open verification form[\s\S]*?<\/table>/gi, responseButtonsHtml);

        // Sanitize and dynamically rewrite any existing /lead-response links in the template
        bodyText = bodyText
            .replace(/href=["'][^"']*\/lead-response[^"']*choice=(?:Interested|yes)[^"']*["']/gi, `href="${interestedUrl}"`)
            .replace(/href=["'][^"']*\/lead-response[^"']*choice=(?:Not[+_]Interested|no)[^"']*["']/gi, `href="${notInterestedUrl}"`)
            .replace(/href=["'][^"']*\/lead-response[^"']*["']/gi, (match) => {
                if (match.toLowerCase().includes('choice=not')) return `href="${notInterestedUrl}"`;
                if (match.toLowerCase().includes('choice=')) return `href="${interestedUrl}"`;
                return `href="${responseFormUrl}"`;
            });

        let emailContentHtml = '';
        const bodyWithBr = bodyText.replace(/\n/g, '<br/>');

        if (bodyWithBr.includes('[YES, I WOULD LIKE TO DISCUSS MY PTE TRAINING OPTIONS]')) {
            emailContentHtml = bodyWithBr.replace(/\[YES, I WOULD LIKE TO DISCUSS MY PTE TRAINING OPTIONS\]/g, responseButtonsHtml);
        } else if (bodyWithBr.includes('[YES, I AM INTERESTED – VERIFY MY ENQUIRY]')) {
            emailContentHtml = bodyWithBr.replace(/\[YES, I AM INTERESTED – VERIFY MY ENQUIRY\]/g, responseButtonsHtml);
        } else if (bodyWithBr.includes('[YES, I AM INTERESTED - VERIFY MY ENQUIRY]')) {
            emailContentHtml = bodyWithBr.replace(/\[YES, I AM INTERESTED - VERIFY MY ENQUIRY\]/g, responseButtonsHtml);
        } else if (bodyWithBr.includes('[Response Buttons]')) {
            emailContentHtml = bodyWithBr.replace(/\[Response Buttons\]/g, responseButtonsHtml);
        } else if (/\[YES,[\s\S]*?(?:OPTIONS|ENQUIRY)\]/i.test(bodyWithBr)) {
            emailContentHtml = bodyWithBr.replace(/\[YES,[\s\S]*?(?:OPTIONS|ENQUIRY)\]/gi, responseButtonsHtml);
        } else if (/✓\s*YES,\s*I[\s\S]*?(?:OPTIONS|ENQUIRY)/gi.test(bodyWithBr)) {
            emailContentHtml = bodyWithBr.replace(/✓\s*YES,\s*I[\s\S]*?(?:OPTIONS|ENQUIRY)/gi, responseButtonsHtml);
        } else if (bodyWithBr.includes(interestedUrl) || bodyWithBr.includes('/lead-response')) {
            // Already contains the sanitized response link within the body text
            emailContentHtml = bodyWithBr;
        } else {
            emailContentHtml = `
                ${bodyWithBr}
                ${responseButtonsHtml}
            `;
        }

        // Clean responsive container matching Aives Australia TESTPREP branding
        const emailHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 20px 10px; background-color: #f1f5f9; font-family: 'Plus Jakarta Sans', Arial, Helvetica, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                    <tr>
                        <td style="background-color: #003366; padding: 22px 28px; text-align: left;">
                            <span style="color: #ffffff; font-size: 18px; font-weight: 800; letter-spacing: 0.5px;">AIVES AUSTRALIA'S TESTPREP</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 28px 28px 32px 28px; font-size: 14px; line-height: 1.65; color: #334155;">
                            ${emailContentHtml}
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 28px; font-size: 12px; color: #64748b; text-align: center;">
                            &copy; ${new Date().getFullYear()} Aives Australia's TESTPREP. All rights reserved.
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;

        // 7. Send email via Brevo (with automatic retry for transient network/DNS drops)
        console.log(`[LEAD WELCOME] Sending welcome email to Student ID ${studentId} (${cleanEmail}) via ${baseUrl}...`);
        let sendResult = null;
        let lastError = null;
        const maxAttempts = 3;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                sendResult = await emailHelper.sendEmail(cleanEmail, subject, emailHtml, effectiveSenderEmail, effectiveSenderName);
                break;
            } catch (attemptErr) {
                lastError = attemptErr;
                console.warn(`[LEAD WELCOME] Attempt ${attempt}/${maxAttempts} failed (${attemptErr.message}). ${attempt < maxAttempts ? 'Retrying in 2s...' : 'All retries exhausted.'}`);
                if (attempt < maxAttempts) {
                    await new Promise(res => setTimeout(res, 2000));
                }
            }
        }

        if (!sendResult) {
            throw lastError || new Error('Failed to send email after retries');
        }

        const messageId = sendResult?.messageId || null;

        // 8. Log success to email_logs
        await emailLog.Save_Email_Log(
            studentId,
            templateId || null,
            cleanEmail,
            subject,
            messageId,
            emailHtml,
            'Success',
            null
        );

        console.log(`[LEAD WELCOME] ✅ Welcome email sent successfully to ${cleanEmail} (Student ID ${studentId}, Message ID: ${messageId})`);
        return { success: true, messageId };

    } catch (error) {
        console.error(`[LEAD WELCOME] ❌ Failed to send welcome email to Student ID ${studentId} (${email}):`, error.message);
        
        // Log failure to email_logs
        try {
            await emailLog.Save_Email_Log(
                studentId,
                null,
                email || null,
                'Welcome Email',
                null,
                'Failed to send automatic welcome email',
                'Failed',
                error.message || String(error)
            );
        } catch (logErr) {
            console.error('[LEAD WELCOME] Could not log failure to email_logs:', logErr.message);
        }

        return { success: false, error: error.message };
    }
}

/**
 * Helper to build personalized lead response links and button HTML
 */
function buildLeadResponseBlock({ studentId, email, name = '', buttonLabel = '', req = null }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (name || '').trim();
    const baseUrl = getBaseUrl(req);
    const token = generateLeadToken(studentId, cleanEmail);
    const interestedUrl = `${baseUrl}/lead-response?email=${encodeURIComponent(cleanEmail)}&name=${encodeURIComponent(cleanName)}&token=${token}&choice=Interested`;
    const notInterestedUrl = `${baseUrl}/lead-response?email=${encodeURIComponent(cleanEmail)}&name=${encodeURIComponent(cleanName)}&token=${token}&choice=Not+Interested`;
    const responseFormUrl = `${baseUrl}/lead-response?email=${encodeURIComponent(cleanEmail)}&name=${encodeURIComponent(cleanName)}&token=${token}`;
    const label = buttonLabel || 'YES, I AM INTERESTED – VERIFY MY ENQUIRY';

    const buttonsHtml = `
        <div style="margin: 20px 0; font-size: 14px; line-height: 1.8;">
            <p style="margin: 0 0 6px 0;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 18px 0 10px 0;">
                        <tr>
                            <td align="left" style="border-radius: 6px; background-color: #003366;">
                                <a href="${interestedUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 6px; background-color: #003366; letter-spacing: 0.5px;">
                                    ${label}
                                </a>
                            </td>
                        </tr>
                    </table>
            </p>
            <p style="margin: 0; font-size: 13px; color: #64748b;">
                <a href="${notInterestedUrl}" target="_blank" style="color: #64748b; text-decoration: underline;">Not Interested / Didn't submit this enquiry</a>
            </p>
        </div>
    `;

    return {
        token,
        interestedUrl,
        notInterestedUrl,
        responseFormUrl,
        buttonsHtml
    };
}

module.exports = {
    sendLeadWelcomeEmail,
    buildLeadResponseBlock,
    getOfficialContactInfo,
    generateLeadToken,
    verifyLeadToken,
    isValidEmail,
    getBaseUrl
};
