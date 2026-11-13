const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

// Prefer IPv4 first to avoid IPv6 getaddrinfo ENOTFOUND timeouts/failures on Windows networks
try {
    if (dns.setDefaultResultOrder) {
        dns.setDefaultResultOrder('ipv4first');
    }
} catch (e) {}

// Fallback DNS resolver querying public DNS (Google 8.8.8.8, Cloudflare 1.1.1.1) when local router DNS fails
const fallbackResolver = new dns.Resolver();
try {
    fallbackResolver.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

let cachedBrevoIps = [];

function customDnsLookup(hostname, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    // 1. First try system lookup
    dns.lookup(hostname, options, (err, address, family) => {
        if (!err && address) {
            if (hostname === 'api.brevo.com') {
                cachedBrevoIps = Array.isArray(address) ? address : [{ address, family: family || 4 }];
            }
            return callback(null, address, family);
        }

        // 2. If system lookup failed with ENOTFOUND or EAI_AGAIN, query public DNS fallback directly
        fallbackResolver.resolve4(hostname, (fallbackErr, addresses) => {
            if (!fallbackErr && addresses && addresses.length > 0) {
                console.log(`[DNS Fallback] Public DNS resolved ${hostname} -> ${addresses[0]}`);
                cachedBrevoIps = addresses.map(ip => ({ address: ip, family: 4 }));
                if (options && options.all) {
                    return callback(null, cachedBrevoIps);
                }
                return callback(null, addresses[0], 4);
            }

            // 3. If public DNS also failed, check if we have previously cached IPs in memory
            if (hostname === 'api.brevo.com' && cachedBrevoIps.length > 0) {
                const cachedIp = cachedBrevoIps[0].address || cachedBrevoIps[0];
                console.warn(`[DNS Fallback] Using cached IP for ${hostname} -> ${cachedIp}`);
                if (options && options.all) {
                    return callback(null, cachedBrevoIps);
                }
                return callback(null, cachedIp, 4);
            }

            return callback(err || fallbackErr);
        });
    });
}

const httpsAgent = new https.Agent({
    keepAlive: true,
    maxCachedSessions: 10,
    lookup: customDnsLookup
});

let AWS = null;
try {
    AWS = require('aws-sdk');
} catch (e) {}

let isLogoUploaded = false;
async function ensureLogoUploadedToS3() {
    if (isLogoUploaded || !AWS) return;
    try {
        const bucket = process.env.AWS_S3_BUCKET || 'ufsnabeelphotoalbum';
        const region = process.env.AWS_REGION || 'us-east-2';
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
        if (!accessKeyId || !secretAccessKey) return;

        const s3 = new AWS.S3({
            accessKeyId,
            secretAccessKey,
            region
        });

        const logoPath = path.join(__dirname, 'aiveslogo_small.png');
        if (!fs.existsSync(logoPath)) return;
        const fileContent = fs.readFileSync(logoPath);

        await s3.putObject({
            Bucket: bucket,
            Key: 'aiveslogo.png',
            Body: fileContent,
            ContentType: 'image/png'
        }).promise();

        isLogoUploaded = true;
        console.log('[Logo S3 Sync] Successfully synced aiveslogo.png to S3 bucket:', bucket);
    } catch (err) {
        console.warn('[Logo S3 Sync] S3 sync notice:', err && err.message ? err.message : err);
    }
}

// Trigger initial sync attempt in background
try {
    ensureLogoUploadedToS3().catch(() => {});
} catch (e) {}

function getLogoUrl() {
    if (process.env.LOGO_URL && process.env.LOGO_URL.trim()) {
        return process.env.LOGO_URL.trim();
    }
    const bucket = process.env.AWS_S3_BUCKET || 'ufsnabeelphotoalbum';
    const region = process.env.AWS_REGION || 'us-east-2';
    return `https://${bucket}.s3.${region}.amazonaws.com/aiveslogo.png`;
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

/**
 * Formats email body HTML so that key sentences, headings, bullet titles,
 * and markdown bold/italic tags (**bold**, *italic*) are rendered cleanly
 * with strong inline styling visible across all email clients.
 */
function formatEmailBodyHtml(html) {
    if (!html || typeof html !== 'string') return '';
    let formatted = html.trim();

    // 1. Markdown bold (**text** or __text__)
    formatted = formatted.replace(/\*\*([\s\S]+?)\*\*/g, '<strong style="font-weight: 700; color: #0f172a;">$1</strong>');
    formatted = formatted.replace(/__([\s\S]+?)__/g, '<strong style="font-weight: 700; color: #0f172a;">$1</strong>');

    // 2. Markdown italic (*text* not adjacent to another * and not a bullet)
    formatted = formatted.replace(/(?<!\*)\*([^*\n\r<]+?)\*(?!\*)/g, '<em style="font-style: italic; color: #64748b;">$1</em>');

    // 3. Ensure existing <strong> and <b> tags have explicit font-weight: 700 inline for email client compatibility
    formatted = formatted.replace(/<strong\b(?![^>]*style=)/gi, '<strong style="font-weight: 700; color: #0f172a;"');
    formatted = formatted.replace(/<b\b(?![^>]*style=)/gi, '<b style="font-weight: 700; color: #0f172a;"');

    // 4. Bullet list labels: • Title: (bold label before colon)
    formatted = formatted.replace(
        /(^|<br\s*\/?>|\n|<p[^>]*>|<div>)(\s*•\s*)([A-Za-z0-9\s/&–\-]+?:)(?!\s*<\/strong>)/g,
        '$1$2<strong style="font-weight: 700; color: #0f172a;">$3</strong>'
    );

    // 5. Numbered list labels: 1. Non-Refundable:
    formatted = formatted.replace(
        /(^|<br\s*\/?>|\n|<p[^>]*>|<div>)(\s*[0-9]+\.\s*[A-Za-z0-9\s/&–\-]+?:)(?!\s*<\/strong>)/g,
        '$1<strong style="font-weight: 700; color: #0f172a;">$2</strong>'
    );

    // 6. Section headings across all templates
    const headings = [
        "Why Choose Aives Australia's TESTPREP\\??",
        "Our distinctive training approach combines:?",
        "Please Verify Your Interest",
        "Didn't Submit This Enquiry\\??",
        "Your Enrolment [Dd]etails:?",
        "Your Training Details:?",
        "Your Zoom Classroom Access",
        "Important\\s*[–\\-]\\s*Non-Refundable\\s*&\\s*Non-Transferable\\s*Programme",
        "A Final Word Before You Begin",
        "Trainer & Class Details:?",
        "Student & Course Details:?",
        "Payment Breakdown:?",
        "Payment Details:?"
    ];

    for (const h of headings) {
        const regex = new RegExp(`(^|<br\\s*\\/?>|\\n|<p[^>]*>|<div>)(?!<strong[^>]*>)\\s*(${h})\\s*(?!\\s*<\\/strong>)(?=<br\\s*\\/?>|\\n|<\\/p>|<\\/div>|$)`, 'gi');
        formatted = formatted.replace(regex, '$1<strong style="font-weight: 700; color: #0f172a;">$2</strong>');
    }

    // 7. Prominent sentences in body
    const prominentPhrases = [
        "qualified Australian immigration law professionals with 20 years of practical experience in understanding English language testing requirements for Australian migration, professional registration, and education pathways\\.",
        "NON-REFUNDABLE AND NON-TRANSFERABLE"
    ];

    for (const p of prominentPhrases) {
        const regex = new RegExp(`(?!<strong[^>]*>)(${p})(?!<\\/strong>)`, 'gi');
        formatted = formatted.replace(regex, '<strong style="font-weight: 700; color: #0f172a;">$1</strong>');
    }

    // 8. Sign-off team titles
    const signoffTeams = [
        "Student Admissions Team",
        "Student Admissions & Administration Team",
        "Academic Coordination Team",
        "Admissions Team"
    ];

    for (const st of signoffTeams) {
        const regex = new RegExp(`(^|<br\\s*\\/?>|\\n)\\s*(${st})\\s*(?=<br\\s*\\/?>|\\n|$)`, 'gi');
        formatted = formatted.replace(regex, '$1<strong style="font-weight: 700; color: #0f172a;">$2</strong>');
    }

    // Also bold company name right under the sign-off team name
    formatted = formatted.replace(
        /(<strong style="font-weight: 700; color: #0f172a;">(?:Student Admissions Team|Student Admissions & Administration Team|Academic Coordination Team|Admissions Team)<\/strong>\s*(?:<br\s*\/?>|\n)\s*)(Aives Australia's TESTPREP|TESTPREP)/gi,
        '$1<strong style="font-weight: 700; color: #0f172a;">$2</strong>'
    );

    return formatted;
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
        const logoUrl = getLogoUrl();
        try {
            ensureLogoUploadedToS3().catch(() => {});
        } catch (e) {}
        // Sanitize incoming HTML to avoid nested full documents or containers
        let cleanHtml = (html && typeof html === 'string') ? html.trim() : '';
        const bodyContentMatch = cleanHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyContentMatch && bodyContentMatch[1]) {
            cleanHtml = bodyContentMatch[1].trim();
        }
        // Unwrap any legacy .email-container if passed
        const legacyContainerMatch = cleanHtml.match(/<div class=["']email-container["'][^>]*>([\s\S]*?)<\/div>\s*$/i);
        if (legacyContainerMatch && legacyContainerMatch[1]) {
            const innerBodyMatch = legacyContainerMatch[1].match(/<div class=["']email-body["'][^>]*>([\s\S]*?)<\/div>/i);
            if (innerBodyMatch && innerBodyMatch[1]) {
                cleanHtml = innerBodyMatch[1].trim();
            }
        }

        // Strip any legacy header if present
        cleanHtml = cleanHtml.replace(/<div class=["']email-header["'][\s\S]*?<\/div>/gi, '');

        // Apply bold formatting to important sentences, headings, and markdown tags
        cleanHtml = formatEmailBodyHtml(cleanHtml);

        const safeSubject = subject ? String(subject).replace(/"/g, '&quot;') : "Aives Australia's TESTPREP";
        const wrappedHtml = `
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <meta http-equiv="X-UA-Compatible" content="IE=edge">
                    <meta name="x-apple-disable-message-reformatting">
                    <title>${safeSubject}</title>
                    <style>
                        html, body {
                            margin: 0 !important;
                            padding: 0 !important;
                            width: 100% !important;
                            min-width: 100% !important;
                            background-color: #ffffff !important;
                            color: #1e293b !important;
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
                            -webkit-text-size-adjust: 100% !important;
                            -ms-text-size-adjust: 100% !important;
                            text-align: left !important;
                        }
                        table, td {
                            border-collapse: collapse !important;
                            mso-table-lspace: 0pt !important;
                            mso-table-rspace: 0pt !important;
                        }
                        img {
                            border: 0 !important;
                            outline: none !important;
                            text-decoration: none !important;
                            -ms-interpolation-mode: bicubic !important;
                            display: block !important;
                        }
                        .email-full-wrapper {
                            width: 100% !important;
                            max-width: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background-color: #ffffff !important;
                            text-align: left !important;
                        }
                        .email-container {
                            width: 100% !important;
                            max-width: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background-color: #ffffff !important;
                            text-align: left !important;
                        }
                        .email-body {
                            background-color: #ffffff !important;
                            padding: 28px 28px !important;
                            font-size: 15px !important;
                            line-height: 1.65 !important;
                            color: #334155 !important;
                            text-align: left !important;
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
                            word-break: break-word !important;
                            overflow-wrap: break-word !important;
                        }
                        .email-footer-details {
                            background-color: #ffffff !important;
                            padding: 24px 28px 20px 28px !important;
                            border-top: 1px solid #e2e8f0 !important;
                            text-align: left !important;
                        }
                        .email-footer {
                            background-color: #003366 !important;
                            padding: 20px 28px !important;
                            text-align: left !important;
                            font-size: 13px !important;
                            line-height: 1.5 !important;
                            color: #e2e8f0 !important;
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
                        }
                        .email-footer p {
                            margin: 0 0 6px 0 !important;
                        }
                        .email-footer p:last-child {
                            margin-bottom: 0 !important;
                        }
                        .email-footer a {
                            color: #93c5fd !important;
                            text-decoration: none !important;
                        }
                        /* Responsive layout for mobile devices */
                        @media only screen and (max-width: 600px) {
                            .email-body {
                                padding: 20px 16px !important;
                                font-size: 14.5px !important;
                                line-height: 1.6 !important;
                            }
                            .email-footer-details {
                                padding: 18px 16px 14px 16px !important;
                            }
                            .footer-table {
                                display: block !important;
                                width: 100% !important;
                            }
                            .footer-col-left {
                                display: block !important;
                                width: 100% !important;
                                max-width: 100% !important;
                                text-align: left !important;
                                padding: 0 0 10px 0 !important;
                            }
                            .footer-col-right {
                                display: block !important;
                                width: 100% !important;
                                max-width: 100% !important;
                                text-align: left !important;
                                padding: 0 !important;
                            }
                            .footer-col-right h2 {
                                font-size: 15px !important;
                                margin-bottom: 3px !important;
                            }
                            .footer-col-right p {
                                font-size: 11.5px !important;
                                line-height: 1.4 !important;
                            }
                            .email-footer {
                                padding: 16px 16px !important;
                                font-size: 12px !important;
                            }
                            .responsive-logo {
                                max-width: 120px !important;
                                width: 120px !important;
                                height: auto !important;
                            }
                        }
                    </style>
                </head>
                <body style="margin: 0; padding: 0; width: 100% !important; min-width: 100%; background-color: #ffffff; color: #1e293b; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: left; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" align="left" class="email-full-wrapper" style="width: 100%; max-width: 100%; border-collapse: collapse; margin: 0; padding: 0; background-color: #ffffff; text-align: left;">
                        <tr>
                            <td align="left" valign="top" style="padding: 0; margin: 0; text-align: left; background-color: #ffffff;">
                                <div class="email-container" style="width: 100%; max-width: 100%; margin: 0; padding: 0; background-color: #ffffff; text-align: left;">
                                    <!-- Email Content Body -->
                                    <div class="email-body" style="background-color: #ffffff; padding: 28px 28px; font-size: 15px; line-height: 1.65; color: #334155; text-align: left; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; word-break: break-word; overflow-wrap: break-word;">
                                        ${cleanHtml}
                                    </div>
                                    <!-- Footer Section: Logo & Address Details above existing footer content -->
                                    <div class="email-footer-details" style="background-color: #ffffff; padding: 24px 28px 20px 28px; border-top: 1px solid #e2e8f0; text-align: left;">
                                        <table role="presentation" class="footer-table" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse;">
                                            <tr>
                                                <td class="footer-col-left" align="left" valign="middle" style="text-align: left; vertical-align: middle; width: 140px; padding: 0 15px 0 0;">
                                                    <img src="${logoUrl}" alt="Aives Australia Test Prep" width="130" border="0" class="responsive-logo" style="max-width: 130px; width: 130px; height: auto; border: 0; outline: none; display: block;" />
                                                </td>
                                                <td class="footer-col-right" align="right" valign="middle" style="text-align: right; vertical-align: middle; padding: 0;">
                                                    <h2 style="margin: 0 0 4px 0; color: #000000; font-size: 16px; font-weight: 700; line-height: 1.3;">AIVES Australia Testprep</h2>
                                                    <p style="margin: 0; color: #333333; font-size: 12px; line-height: 1.45;">
                                                        Address: 2nd Floor, Geo Centre, Door No. 45, 1920 B3,<br/>
                                                        NH-66, Chakkaraparambu, Vennala, Ernakulam, Kerala 682032
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </div>
                                    <!-- Existing Footer Content -->
                                    <div class="email-footer" style="background-color: #003366; padding: 20px 28px; text-align: left; font-size: 13px; line-height: 1.5; color: #e2e8f0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                                        <p style="margin: 0 0 4px 0; color: #ffffff; font-weight: 600; font-size: 13px;">&copy; ${year} Aives Australia Test Prep. All rights reserved.</p>
                                        <p style="margin: 0; color: #cbd5e1; font-size: 12px;">You can reply directly to this email.</p>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </table>
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
        const maxAttempts = 4;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
                    timeout: 20000,
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
                const isNetworkOrDnsError = !err.response || err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN' || err.code === 'EPROTO' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || errStatus >= 500;
                if (attempt < maxAttempts && isNetworkOrDnsError) {
                    const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    console.warn(`[Brevo Network/DNS Warning] Attempt ${attempt}/${maxAttempts} failed (${err.code || err.message}). Retrying in ${delayMs}ms...`);
                    await new Promise(r => setTimeout(r, delayMs));
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

