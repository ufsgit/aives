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
    // 1. Dynamic Host detection from incoming request (takes precedence if a live public host is accessing the API)
    if (req) {
        const rawHost = (req.headers && (req.headers['x-forwarded-host'] || req.headers['host'])) ||
                        (typeof req.get === 'function' ? req.get('host') : '');
        const host = String(rawHost || '').trim();

        const rawProto = (req.headers && (req.headers['x-forwarded-proto'] || req.protocol)) || 'http';
        const proto = String(rawProto).split(',')[0].trim();

        if (host && !isPrivateOrLocalHost(host) && !isBrokenTunnelUrl(host)) {
            return `${proto}://${host}`;
        }
    }

    // 2. Explicit APP_URL in environment (if configured and not an ephemeral broken tunnel)
    if (process.env.APP_URL && !isBrokenTunnelUrl(process.env.APP_URL)) {
        return process.env.APP_URL.trim().replace(/\/$/, '');
    }

    // 3. Explicit BACKEND_URL in environment
    if (process.env.BACKEND_URL && !isBrokenTunnelUrl(process.env.BACKEND_URL)) {
        return process.env.BACKEND_URL.trim().replace(/\/$/, '');
    }

    // 4. Production fallback domain
    if (process.env.NODE_ENV === 'production') {
        return 'https://aiveseduapi.ufstech.co.in';
    }

    // 5. Auto-detect active non-internal IPv4 (Wi-Fi or LAN) for local multi-device testing
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                const port = process.env.PORT || 3520;
                return `http://${iface.address}:${port}`;
            }
        }
    }

    // 6. Stable local fallback
    const port = process.env.PORT || 3520;
    return `http://10.53.196.109:${port}`;
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
        const cleanEmail = (email || '').trim();
        const cleanName = (name || 'Valued Student').trim();
        const cleanPhone = (phone || '').trim();
        let effectiveSenderEmail = senderEmail || (req && (req.userEmail || (req.body && req.body.Sender_Email))) || null;
        let effectiveSenderName = senderName || (req && (req.userName || (req.body && req.body.Sender_Name))) || null;

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

        // 1. Fetch template from DB
        let template = null;
        let templateId = null;
        try {
            const [templates] = await db.promise().query(
                `SELECT Template_ID, Template_Name, Subject, Body, Is_Active 
                 FROM email_templates 
                 WHERE Template_Name = 'Lead Welcome & Response Form' 
                   AND (Delete_Status = 0 OR Delete_Status IS NULL) 
                   AND Is_Active = 1
                 LIMIT 1`
            );
            if (templates && templates.length > 0) {
                template = templates[0];
                templateId = template.Template_ID;
            } else {
                // No active template found — could be missing or inactive
                console.log(`[LEAD WELCOME] Skipped for Student ${studentId}: 'Lead Welcome & Response Form' template not found or is inactive.`);
                return { success: false, skipped: true, reason: 'Template inactive or not found' };
            }
        } catch (dbErr) {
            console.error('[LEAD WELCOME] Error fetching email template from DB:', dbErr.message);
        }

        // 2. Prevent duplicate welcome emails for this student
        try {
            const [existingLogs] = await db.promise().query(
                `SELECT Log_ID, Status FROM email_logs 
                 WHERE Student_ID = ? 
                   AND (Template_ID = ? OR Subject LIKE '%courses%' OR Subject LIKE '%Welcome%') 
                   AND Status = 'Success' 
                 LIMIT 1`,
                [studentId, templateId || 13]
            );

            if (existingLogs && existingLogs.length > 0) {
                console.log(`[LEAD WELCOME] Duplicate check: Welcome email already sent to Student ID ${studentId} (${cleanEmail}). Skipping.`);
                return { success: true, skipped: true, reason: 'Already sent' };
            }
        } catch (logErr) {
            console.warn('[LEAD WELCOME] Warning checking existing email logs:', logErr.message);
        }

        // 3. Construct Secure URLs using reachable host (never localhost)
        const baseUrl = getBaseUrl(req);
        const token = generateLeadToken(studentId, cleanEmail);
        const interestedUrl = `${baseUrl}/lead-response?id=${studentId}&email=${encodeURIComponent(cleanEmail)}&token=${token}&choice=Interested`;
        const notInterestedUrl = `${baseUrl}/lead-response?id=${studentId}&email=${encodeURIComponent(cleanEmail)}&token=${token}&choice=Not+Interested`;
        const responseFormUrl = `${baseUrl}/lead-response?id=${studentId}&email=${encodeURIComponent(cleanEmail)}&token=${token}`;

        // 4. Build Subject
        let subject = template?.Subject || 'Welcome to Trackbox - Are you interested in our courses?';
        subject = subject.replace(/\[Student Name\]/g, cleanName)
                         .replace(/\[Name\]/g, cleanName)
                         .replace(/\[Email\]/g, cleanEmail);

        // 5. 1-Click Interactive Buttons Block for Email (Mobile & Desktop Friendly)
        const responseButtonsHtml = `
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px 16px; margin: 24px 0; text-align: center;">
                <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; line-height: 1.4;">
                    Are you interested in our coaching and training programs?
                </p>
                <p style="font-size: 13px; color: #64748b; margin: 0 0 20px 0;">
                    Please tap your choice below to let us know:
                </p>

                <!-- Two Mobile-Friendly Touch Buttons -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; width: 100%; max-width: 440px;">
                    <tr>
                        <td style="padding: 6px; text-align: center;" width="50%">
                            <a href="${interestedUrl}" target="_blank" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 14px 18px; font-size: 15px; font-weight: 700; border-radius: 8px; display: block; text-align: center; box-shadow: 0 4px 6px -1px rgba(22, 163, 74, 0.25);">
                                👍 Yes, I'm Interested
                            </a>
                        </td>
                        <td style="padding: 6px; text-align: center;" width="50%">
                            <a href="${notInterestedUrl}" target="_blank" style="background-color: #64748b; color: #ffffff; text-decoration: none; padding: 14px 18px; font-size: 15px; font-weight: 700; border-radius: 8px; display: block; text-align: center; box-shadow: 0 4px 6px -1px rgba(100, 116, 139, 0.25);">
                                👎 Not Interested
                            </a>
                        </td>
                    </tr>
                </table>

                <div style="margin-top: 22px; padding-top: 14px; border-top: 1px dashed #cbd5e1; font-size: 13px; color: #64748b;">
                    Prefer opening the form or adding notes? 
                    <a href="${responseFormUrl}" target="_blank" style="color: #0284c7; font-weight: 700; text-decoration: underline;">
                        Click here to open the response form
                    </a>
                </div>
            </div>
        `;

        // 6. Assemble email body text
        let bodyText = template?.Body || `Dear [Student Name],\n\nThank you for your interest in Trackbox! We look forward to supporting you on your learning journey.\n\nPlease let us know if you are interested in joining our coaching programs:\n\n[Response Buttons]\n\nIf you have any questions or need immediate assistance, feel free to reach out to our team.\n\nBest regards,\nAdmissions & Training Team\nTrackbox`;

        // Substitute placeholders
        bodyText = bodyText.replace(/\[Student Name\]/g, cleanName)
                           .replace(/\[Name\]/g, cleanName)
                           .replace(/\[Email\]/g, cleanEmail);

        let emailHtml = '';
        const bodyWithBr = bodyText.replace(/\n/g, '<br/>');
        if (bodyWithBr.includes('[Response Buttons]')) {
            emailHtml = bodyWithBr.replace(/\[Response Buttons\]/g, responseButtonsHtml);
        } else {
            emailHtml = `
                <div>
                    ${bodyWithBr}
                    ${responseButtonsHtml}
                </div>
            `;
        }

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

module.exports = {
    sendLeadWelcomeEmail,
    generateLeadToken,
    verifyLeadToken,
    isValidEmail,
    getBaseUrl
};
