const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');

const httpsAgent = new https.Agent({
    keepAlive: false,
    maxCachedSessions: 0
});

let logoBase64 = '';
try {
    const logoPath = path.join(__dirname, 'aiveslogo_small.png');
    logoBase64 = fs.readFileSync(logoPath, 'base64');
} catch (e) {
    console.error('Failed to load logo image:', e);
}

/**
 * Resolves Brevo credentials (API key, sender email, sender name)
 * dynamically based on the originating sender / logged-in user.
 */
function getBrevoConfig(fromEmail = null, fromName = null) {
    try {
        require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });
    } catch (dotenvErr) {}

    let rawFrom = (fromEmail && String(fromEmail).trim()) ? String(fromEmail).trim().toLowerCase() : '';
    const defaultSenderEmail = (process.env.BREVO_SENDER_EMAIL || 'cs.mgr@testprepinenglish.com').trim().replace(/^['\"]|['\"]$/g, '').toLowerCase();
    if (rawFrom === 'admin_user@g.com' || rawFrom === 'admin_user') {
        rawFrom = defaultSenderEmail;
    }
    const configuredTrainer2Email = (process.env.BREVO_SENDER_EMAIL_TRAINER2 || 'ufsdev123@gmail.com').trim().toLowerCase();

    // Check if the sender is Trainer 2 (by login email ufsdev123@gmail.com, trainer2 alias, or configured env)
    const isTrainer2 = rawFrom === 'ufsdev123@gmail.com' ||
                       rawFrom === 'trainer2@testprepinenglish.com' ||
                       rawFrom === configuredTrainer2Email;

    // Sender Name: Always display as "TestPerp Aives" consistently across all outgoing emails
    const globalSenderName = (process.env.BREVO_SENDER_NAME || 'TestPerp Aives').trim().replace(/^['\"]|['\"]$/g, '') || 'TestPerp Aives';

    if (isTrainer2) {
        const apiKey = (
            process.env.BREVO_API_KEY_TRAINER2 ||
            process.env.BREVO_API_KEY_UFSDEV123 ||
            process.env.BREVO_TRAINER2_API_KEY ||
            ''
        ).trim().replace(/^['\"]|['\"]$/g, '');

        const senderEmail = (process.env.BREVO_SENDER_EMAIL_TRAINER2 || 'ufsdev123@gmail.com').trim().replace(/^['\"]|['\"]$/g, '').toLowerCase();

        return {
            apiKey: apiKey || (process.env.BREVO_API_KEY || '').trim().replace(/^['\"]|['\"]$/g, ''),
            senderEmail: senderEmail,
            senderName: globalSenderName,
            accountType: 'TRAINER2_DEDICATED',
            accountEmail: 'ufsdev123@gmail.com'
        };
    }

    // Default / Main Brevo Account (Admin cs.mgr@testprepinenglish.com, Trainer 1 trainer1@testprepinenglish.com, etc.)
    const apiKey = (process.env.BREVO_API_KEY || '').trim().replace(/^['\"]|['\"]$/g, '');

    // Verified senders in the Main Brevo Account: trainer1@testprepinenglish.com and cs.mgr@testprepinenglish.com
    const isTrainer1 = rawFrom === 'trainer1@testprepinenglish.com';
    const isMainAdmin = rawFrom === defaultSenderEmail;
    const senderEmail = isTrainer1 ? 'trainer1@testprepinenglish.com' : defaultSenderEmail;

    return {
        apiKey,
        senderEmail: senderEmail || defaultSenderEmail,
        senderName: globalSenderName,
        accountType: 'MAIN_ACCOUNT',
        accountEmail: defaultSenderEmail
    };
}

const sendEmail = async (to, subject, html, fromEmail = null, fromName = null, attachments = null) => {
    let brevoConfig = null;
    let apiKey = null;
    let finalSenderEmail = null;
    let finalSenderName = null;
    let emailData = null;
    try {
        if (!to) {
            throw new Error('Recipient email (to) is missing');
        }

        brevoConfig = getBrevoConfig(fromEmail, fromName);
        apiKey = brevoConfig.apiKey;
        finalSenderEmail = brevoConfig.senderEmail;
        finalSenderName = brevoConfig.senderName;

        if (!apiKey) {
            throw new Error(`Brevo API key is missing for ${brevoConfig.accountType} (${finalSenderEmail})`);
        }

        console.log('Brevo API sendEmail request preparation:', { 
            to, 
            subject, 
            finalSenderEmail,
            finalSenderName,
            accountType: brevoConfig.accountType,
            accountEmail: brevoConfig.accountEmail,
            apiKeyFound: !!apiKey,
            apiKeyConfigured: !!apiKey,
            originalFrom: fromEmail,
            usingDefault: !fromEmail,
            hasAttachments: !!(attachments && attachments.length)
        });

        const year = new Date().getFullYear();
        const wrappedHtml = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body {
                            margin: 0;
                            padding: 0;
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            background-color: #f8fafc;
                            color: #1e293b;
                        }
                        .email-container {
                            max-width: 600px;
                            margin: 40px auto;
                            background-color: #ffffff;
                            border-radius: 12px;
                            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                            overflow: hidden;
                        }
                        .email-header {
                            background-color: #ffffff;
                            padding: 20px;
                            border-bottom: 4px solid #f10505ff;
                        }
                        .email-header h1 {
                            margin: 0;
                            font-weight: 800;
                            letter-spacing: 0.5px;
                            text-transform: uppercase;
                        }
                        .email-header .title-top {
                            color: #003366;
                            font-size: 20px;
                            display: block;
                            margin-bottom: 4px;
                        }
                        .email-header .title-bottom {
                            color: #f20808ff;
                            font-size: 38px;
                            letter-spacing: -1px;
                        }
                        .email-body {
                            padding: 40px 30px;
                            font-size: 16px;
                            line-height: 1.6;
                            color: #334155;
                        }
                        .email-footer {
                            background-color: #003366;
                            padding: 24px 30px;
                            text-align: center;
                            font-size: 13px;
                            color: #e2e8f0;
                        }
                        .email-footer p {
                            margin: 0 0 8px 0;
                        }
                        .email-footer a {
                            color: #93c5fd;
                            text-decoration: none;
                        }
                    </style>
                </head>
                <body>
                    <div class="email-container">
                        <div class="email-header">
                            <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td align="left" valign="middle" width="140">
                                        ${logoBase64 ? `<img src="cid:aiveslogo.png" alt="Aives Australia Test Prep" width="130" border="0" style="max-width: 130px; height: auto; border: none; outline: none; display: block;" />` : `
                                        <h1 style="margin: 0; color: #003366; font-size: 18px;">Aives Australia</h1>`}
                                    </td>
                                    <td align="right" valign="middle" style="text-align: right; padding-left: 15px;">
                                        <h2 style="margin: 0 0 5px 0; color: #000000; font-size: 18px; font-weight: 700;">AIVES Australia Testprep</h2>
                                        <p style="margin: 0; color: #333333; font-size: 12px; line-height: 1.4;">
                                            Address: 2nd Floor, Geo Centre, Door No. 45, 1920 B3,<br/>
                                            NH-66, Chakkaraparambu, Vennala, Ernakulam, Kerala 682032
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </div>
                        <div class="email-body">
                            ${html}
                        </div>
                        <div class="email-footer">
                            <p>&copy; ${year} Aives Australia Test Prep. All rights reserved.</p>
                            <p>You can reply directly to this email.</p>
                        </div>
                    </div>
                </body>
            </html>
        `;

        console.log(`>>> Sending email TO: [${to}] | FROM: [${finalSenderEmail}] | SUBJECT: [${subject}]`);

        emailData = {
            sender: {
                name: finalSenderName,
                email: finalSenderEmail
            },
            to: [{
                email: to
            }],
            subject: subject,
            htmlContent: wrappedHtml,
            replyTo: {
                name: finalSenderName,
                email: finalSenderEmail
            }
        };

        const finalAttachments = [];

        if (attachments && Array.isArray(attachments) && attachments.length > 0) {
            finalAttachments.push(...attachments);
        }

        // Attach logo for inline display if available
        if (logoBase64) {
            finalAttachments.push({
                content: logoBase64,
                name: 'aiveslogo.png'
            });
        }

        if (finalAttachments.length > 0) {
            emailData.attachment = finalAttachments;
        }

        const configuredReplyTo = (process.env.REPLY_TO_EMAIL || process.env.BREVO_REPLY_TO || '').trim();
        let normalizedReplyToEmail = (fromEmail && String(fromEmail).includes('@')) ? String(fromEmail).trim() : finalSenderEmail;
        if (normalizedReplyToEmail.toLowerCase() === 'admin_user@g.com' || normalizedReplyToEmail.toLowerCase() === 'admin_user') {
            normalizedReplyToEmail = finalSenderEmail;
        }

        if (configuredReplyTo) {
            emailData.replyTo = {
                email: configuredReplyTo,
                name: finalSenderName
            };
        } else {
            emailData.replyTo = {
                email: normalizedReplyToEmail,
                name: finalSenderName
            };
        }

        let response;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                response = await axios({
                    method: 'post',
                    url: 'https://api.brevo.com/v3/smtp/email',
                    headers: {
                        'accept': 'application/json',
                        'api-key': apiKey,
                        'content-type': 'application/json'
                    },
                    httpsAgent: httpsAgent,
                    timeout: 15000,
                    data: emailData
                });
                break;
            } catch (err) {
                const errStatus = err.response ? err.response.status : null;
                const errMsg = err.response?.data?.message || err.message;
                if (errStatus === 401 || errStatus === 403) {
                    console.error(`[Brevo Auth Error] Authentication failed (status ${errStatus}): ${errMsg}. Halting retries. Please verify BREVO_API_KEY in .env and Brevo account permissions.`);
                    throw err;
                }
                if (attempt < 3 && (!err.response || err.code === 'EPROTO' || err.code === 'ECONNRESET' || errStatus >= 500)) {
                    console.warn(`Transient SSL/network error sending email (attempt ${attempt}/3). Retrying...`, err.message);
                    await new Promise(r => setTimeout(r, 600 * attempt));
                    continue;
                }
                throw err;
            }
        }
        
        console.log('Brevo API response success - status:', response.status, '| data:', JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        let errorMessage = error.message;
        if (error.response && error.response.data) {
            errorMessage = error.response.data.message || error.response.data.code || JSON.stringify(error.response.data);
        }

        console.error('Error sending email via Brevo API:', {
            message: errorMessage,
            originalError: error.message,
            responseData: error.response ? error.response.data : 'No response data',
            to: to,
            apiKeyFound: !!apiKey,
            accountType: brevoConfig ? brevoConfig.accountType : 'UNKNOWN',
            senderEmail: finalSenderEmail
        });

        // If a dedicated account (e.g. Trainer 2) fails due to IP whitelist restrictions or auth,
        // automatically fallback to the verified Main Brevo account to ensure the lead email is delivered!
        const mainApiKey = (process.env.BREVO_API_KEY || '').trim().replace(/^['\"]|['\"]$/g, '');
        if (brevoConfig && brevoConfig.accountType !== 'MAIN_ACCOUNT' && mainApiKey && mainApiKey !== apiKey) {
            console.warn(`[Brevo Fallback] ${brevoConfig.accountType} failed (${errorMessage}). Attempting automatic fallback to Main Brevo account...`);
            try {
                const fallbackResponse = await axios({
                    method: 'post',
                    url: 'https://api.brevo.com/v3/smtp/email',
                    headers: {
                        'accept': 'application/json',
                        'api-key': mainApiKey,
                        'content-type': 'application/json'
                    },
                    httpsAgent: httpsAgent,
                    timeout: 15000,
                    data: emailData
                });
                console.log('[Brevo Fallback] Success! Email sent via Main Brevo account - status:', fallbackResponse.status, '| messageId:', fallbackResponse.data?.messageId);
                return fallbackResponse.data;
            } catch (fallbackError) {
                console.error('[Brevo Fallback] Main account fallback failed as well:', fallbackError.response?.data || fallbackError.message);
            }
        }

        const enhancedError = new Error(errorMessage);
        enhancedError.originalError = error;
        enhancedError.responseData = error.response ? error.response.data : null;
        throw enhancedError;
    }
};

module.exports = {
    sendEmail,
    getBrevoConfig
};

