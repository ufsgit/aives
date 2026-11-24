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

function getLogoUrl() {
    if (process.env.LOGO_URL && process.env.LOGO_URL.trim()) {
        return process.env.LOGO_URL.trim();
    }
    // High-availability global CDN hosted directly from repository
    return 'https://cdn.jsdelivr.net/gh/ufsgit/aives@main/Backend/public/images/aiveslogo.png';
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

    // 0. Heal accidental soft-wrap line breaks before headings or sentences
    formatted = formatted.replace(/<br\s*\/?>\s*([a-z])/g, (match, letter) => {
        if (letter === letter.toLowerCase() && letter !== letter.toUpperCase()) {
            return ' ' + letter;
        }
        return match;
    });
    formatted = formatted.replace(/(TESTPREP\s+Administration)<br\s*\/?>\s*(Team)/gi, '$1 $2');
    formatted = formatted.replace(/(Important)<br\s*\/?>\s*(Student\s+Guidelines)/gi, '$1 $2');
    formatted = formatted.replace(/(Important\s+Reminder)<br\s*\/?>\s*([–\-]\s*Enrolment)/gi, '$1 $2');

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
        "Payment Details:?",
        "Week 3\\s*[–\\-]\\s*Transform Your PTE Training into Exam-Ready Performance",
        "Week 2\\s*[–\\-]\\s*Focus, Discipline & Prepare Your Mind for PTE Success",
        "Your First Week at TESTPREP\\s*[–\\-]\\s*Are You Practising Enough\\??",
        "Important Student Guidelines",
        "Important Reminder\\s*[–\\-]\\s*Enrolment Policy",
        "Your Student Support"
    ];

    for (const h of headings) {
        const regex = new RegExp(`(^|<br\\s*\\/?>|\\n|<p[^>]*>|<div>)(?!<strong[^>]*>)\\s*(${h})\\s*(?!\\s*<\\/strong>)(?=<br\\s*\\/?>|\\n|<\\/p>|<\\/div>|$)`, 'gi');
        formatted = formatted.replace(regex, '$1<strong style="font-weight: 700; color: #0f172a;">$2</strong>');
    }

    // 7. Prominent sentences in body
    const prominentPhrases = [
        "Your TESTPREP PTE Academic Training Programme is NON-REFUNDABLE and NON-TRANSFERABLE, except where applicable law provides otherwise\\.?",
        "qualified Australian immigration law professionals with 20 years of practical experience in understanding English language testing requirements for Australian migration, professional registration, and education pathways\\.",
        "NON-REFUNDABLE AND NON-TRANSFERABLE"
    ];

    for (const p of prominentPhrases) {
        const regex = new RegExp(`(?!<strong[^>]*>)(${p})(?!<\\/strong>)`, 'gi');
        formatted = formatted.replace(regex, '<strong style="font-weight: 700; color: #0f172a;">$1</strong>');
    }

    // 7b. Specific prompt labels like "Remember:"
    formatted = formatted.replace(
        /(^|<br\s*\/?>|\n|<p[^>]*>|<div>)(\s*)(Remember:)(?!\s*<\/strong>)/gi,
        '$1$2<strong style="font-weight: 700; color: #0f172a;">$3</strong>'
    );

    // 8. Sign-off team titles & coordinator names
    const signoffTeams = [
        "Student Admissions Team",
        "Student Admissions & Administration Team",
        "Academic Coordination Team",
        "Admissions Team",
        "Student Success Team",
        "TESTPREP Training & Student Success Team"
    ];

    for (const st of signoffTeams) {
        const regex = new RegExp(`(^|<br\\s*\\/?>|\\n)\\s*(${st})\\s*(?=<br\\s*\\/?>|\\n|$)`, 'gi');
        formatted = formatted.replace(regex, '$1<strong style="font-weight: 700; color: #0f172a;">$2</strong>');
    }

    // Bold coordinator name Roshni in sign-off
    formatted = formatted.replace(
        /(^|<br\s*\/?>|\n|<p[^>]*>|<div>)(\s*)(Roshni)(?=\s*(?:<br\s*\/?>|\n|<\/p>|CRM))/gi,
        '$1$2<strong style="font-weight: 700; color: #0f172a;">$3</strong>'
    );

    // Also bold company name right under the sign-off team name
    formatted = formatted.replace(
        /(<strong style="font-weight: 700; color: #0f172a;">(?:Student Admissions Team|Student Admissions & Administration Team|Academic Coordination Team|Admissions Team|Student Success Team|TESTPREP Training & Student Success Team)<\/strong>\s*(?:<br\s*\/?>|\n)\s*)(Aives Australia's TESTPREP|TESTPREP)/gi,
        '$1<strong style="font-weight: 700; color: #0f172a;">$2</strong>'
    );

    return formatted;
}

/**
 * Inlines consistent, client-safe CSS styles directly onto HTML tags
 * ensuring full visual parity with the frontend template preview
 * across Gmail (web/app), Outlook desktop/web, Apple Mail, and mobile devices.
 */
function applyEmailInlineStyles(html) {
    if (!html || typeof html !== 'string') return '';
    let content = html.trim();

    // 1. If content lacks HTML block tags, structure it into styled paragraphs
    const hasBlockTags = /<\/?(?:p|div|table|tr|td|th|tbody|thead|ul|ol|li|h[1-6]|blockquote)\b/i.test(content);
    if (!hasBlockTags) {
        const paragraphs = content.split(/\r?\n\s*\r?\n/);
        content = paragraphs
            .map(p => {
                const trimmed = p.trim();
                if (!trimmed) return '';
                return `<p style="margin: 0 0 14px 0; line-height: 1.65; font-size: 15px; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${trimmed.replace(/\r?\n/g, '<br>')}</p>`;
            })
            .filter(p => !!p)
            .join('');
    } else {
        // If content already contains HTML block tags, collapse source newlines into spaces
        // (prevents inadvertent soft wraps from rendering as line breaks in email clients)
        content = content.replace(/\r?\n/g, ' ');
    }

    // 2. Heal accidental line wraps:
    // e.g. <br> immediately followed by a lowercase letter was an accidental soft wrap
    content = content.replace(/<br\s*\/?>\s*([a-z])/g, (match, letter) => {
        if (letter === letter.toLowerCase() && letter !== letter.toUpperCase()) {
            return ' ' + letter;
        }
        return match;
    });

    // Specifically heal common split phrases
    content = content.replace(/(TESTPREP\s+Administration)<br\s*\/?>\s*(Team)/gi, '$1 $2');
    content = content.replace(/(Important)<br\s*\/?>\s*(Student\s+Guidelines)/gi, '$1 $2');
    content = content.replace(/(Important\s+Reminder)<br\s*\/?>\s*([–\-]\s*Enrolment)/gi, '$1 $2');

    // 3. Clean up <br> tags adjacent to block elements to prevent unwanted whitespace
    content = content.replace(/<(p|div|li|h[1-6]|blockquote)\b([^>]*)>\s*<br\s*\/?>/gi, '<$1$2>');
    content = content.replace(/<br\s*\/?>\s*<\/(p|div|li|h[1-6]|blockquote)>/gi, '</$1>');
    content = content.replace(/<\/(p|div|li|ol|ul|table|tr|td|h[1-6]|blockquote)>\s*<br\s*\/?>/gi, '</$1>');
    content = content.replace(/<br\s*\/?>\s*<(p|div|li|ol|ul|table|tr|td|h[1-6]|blockquote)\b/gi, '<$1');
    content = content.replace(/<(ol|ul)\b([^>]*)>\s*<br\s*\/?>/gi, '<$1$2>');
    content = content.replace(/<br\s*\/?>\s*<\/(ol|ul)>/gi, '</$1>');

    // 4. Style <p> tags with inline styles
    content = content.replace(/<p\b([^>]*)>/gi, (match, attrs) => {
        if (!attrs || !attrs.includes('style=')) {
            return `<p style="margin: 0 0 14px 0; line-height: 1.65; font-size: 15px; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;"${attrs}>`;
        }
        let styleVal = '';
        const styleMatch = attrs.match(/style=["']([^"']*)["']/i);
        if (styleMatch) {
            styleVal = styleMatch[1].trim();
            if (!styleVal.endsWith(';')) styleVal += ';';
            if (!styleVal.includes('font-family:')) {
                styleVal += " font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;";
            }
            if (!styleVal.includes('line-height:')) {
                styleVal += ' line-height: 1.65;';
            }
            if (!styleVal.includes('font-size:')) {
                styleVal += ' font-size: 15px;';
            }
            if (!styleVal.includes('color:')) {
                styleVal += ' color: #334155;';
            }
            if (!styleVal.includes('margin:')) {
                styleVal += ' margin: 0 0 14px 0;';
            }
            const cleanAttrs = attrs.replace(/style=["'][^"']*["']/i, `style="${styleVal.trim()}"`);
            return `<p${cleanAttrs}>`;
        }
        return match;
    });

    // 5. Style <ol> and <ul> lists
    content = content.replace(/<ol\b([^>]*)>/gi, (match, attrs) => {
        if (!attrs || !attrs.includes('style=')) {
            return `<ol style="margin: 0 0 16px 0; padding-left: 24px; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;"${attrs}>`;
        }
        return match;
    });
    content = content.replace(/<ul\b([^>]*)>/gi, (match, attrs) => {
        if (!attrs || !attrs.includes('style=')) {
            return `<ul style="margin: 0 0 16px 0; padding-left: 24px; list-style-type: disc; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;"${attrs}>`;
        }
        return match;
    });

    // 6. Style <li> list items
    content = content.replace(/<li\b([^>]*)>/gi, (match, attrs) => {
        if (!attrs || !attrs.includes('style=')) {
            return `<li style="margin-bottom: 6px; line-height: 1.65; font-size: 15px; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;"${attrs}>`;
        }
        return match;
    });

    // 7. Style <blockquote> tags (for indented sections)
    content = content.replace(/<blockquote\b([^>]*)>/gi, (match, attrs) => {
        if (!attrs || !attrs.includes('style=')) {
            return `<blockquote style="margin: 0 0 14px 20px; padding: 4px 0 4px 14px; border-left: 3px solid #cbd5e1; color: #475569; font-style: normal; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;"${attrs}>`;
        }
        return match;
    });

    // 8. Style headings <h1> - <h4>
    content = content.replace(/<h1\b([^>]*)>/gi, '<h1 style="margin: 20px 0 10px 0; font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.35; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif;"$1>');
    content = content.replace(/<h2\b([^>]*)>/gi, '<h2 style="margin: 18px 0 10px 0; font-size: 19px; font-weight: 700; color: #0f172a; line-height: 1.35; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif;"$1>');
    content = content.replace(/<h3\b([^>]*)>/gi, '<h3 style="margin: 16px 0 8px 0; font-size: 17px; font-weight: 700; color: #0f172a; line-height: 1.35; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif;"$1>');
    content = content.replace(/<h4\b([^>]*)>/gi, '<h4 style="margin: 14px 0 6px 0; font-size: 15px; font-weight: 700; color: #0f172a; line-height: 1.35; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif;"$1>');

    // 9. Style strong, b, em, i, u inline elements
    content = content.replace(/<strong\b(?![^>]*style=)/gi, '<strong style="font-weight: 700; color: #0f172a;"');
    content = content.replace(/<b\b(?![^>]*style=)/gi, '<b style="font-weight: 700; color: #0f172a;"');
    content = content.replace(/<em\b(?![^>]*style=)/gi, '<em style="font-style: italic; color: #475569;"');
    content = content.replace(/<i\b(?![^>]*style=)/gi, '<i style="font-style: italic; color: #475569;"');
    content = content.replace(/<u\b(?![^>]*style=)/gi, '<u style="text-decoration: underline;"');

    return content;
}

/**
 * Converts formatted HTML content into clean plain text for the email's textContent.
 * Sending both htmlContent and textContent creates a standard multipart/alternative
 * MIME message, preventing spam filters from flagging the email as HTML-only (MIME_HTML_ONLY).
 */
function htmlToPlainText(html) {
    if (!html || typeof html !== 'string') return '';
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:p|div|h[1-6])>/gi, '\n\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<\/tr>/gi, '\n')
        .replace(/<td[^>]*>/gi, '  ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
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

        // Check if this email includes the automated enquiry verification disclaimer
        // (either in incoming HTML or for Lead Welcome & Response Form enquiry emails)
        const disclaimerRegex = /(?:<br\s*\/?>|\n|\r)*(?:<p[^>]*>)?(?:<[^>]+>|\*|_)*\s*This is an automated enquiry verification email generated by Aives Australia's TESTPREP CRM\s*(?:<\/[^>]+>|\*|_)*(?:<\/p>)?(?:<br\s*\/?>|\n|\r)*/gi;
        let hasEnquiryDisclaimer = false;
        if (disclaimerRegex.test(cleanHtml)) {
            hasEnquiryDisclaimer = true;
            cleanHtml = cleanHtml.replace(disclaimerRegex, '').trim();
        } else if (/Verify Your PTE Academic Enquiry/i.test(subject) || /Lead Welcome/i.test(subject)) {
            hasEnquiryDisclaimer = true;
        }
        cleanHtml = cleanHtml.replace(/(?:<br\s*\/?>|\s)+$/gi, '').trim();

        // Replace any broken S3 or legacy logo URLs inside incoming HTML with the reliable CDN logo URL
        cleanHtml = cleanHtml.replace(
            /<img[^>]+src=["'][^"']*(?:aiveslogo|ufsnabeelphotoalbum)[^"']*["'][^>]*>/gi,
            `<img src="${logoUrl}" alt="AIVES Australia Testprep" width="80" height="80" border="0" class="header-logo" style="width: 80px; max-width: 80px; height: 80px; border: 0; outline: none; display: block;" />`
        );

        // Apply bold formatting to important sentences, headings, and markdown tags
        cleanHtml = formatEmailBodyHtml(cleanHtml);

        // Inlined styling on all HTML elements ensuring exact layout preservation across email clients
        cleanHtml = applyEmailInlineStyles(cleanHtml);

        const safeSubject = subject ? String(subject).replace(/"/g, '&quot;') : "Aives Australia's TESTPREP";
        const wrappedHtml = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="x-apple-disable-message-reformatting" />
        <title>${safeSubject}</title>
        <!--[if mso]>
        <noscript>
            <xml>
                <o:OfficeDocumentSettings>
                    <o:PixelsPerInch>96</o:PixelsPerInch>
                </o:OfficeDocumentSettings>
            </xml>
        </noscript>
        <![endif]-->
        <style type="text/css">
            html, body {
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                min-width: 100% !important;
                background-color: #ffffff !important;
                color: #1e293b !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
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
            .email-main-body {
                background-color: #ffffff !important;
                padding: 24px 28px 24px 28px !important;
                font-size: 15px !important;
                line-height: 1.65 !important;
                color: #334155 !important;
                text-align: left !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
                word-break: break-word !important;
                overflow-wrap: break-word !important;
            }
            /* Responsive styles for mobile email clients */
            @media only screen and (max-width: 600px) {
                .email-main-body {
                    padding: 16px 16px 20px 16px !important;
                    font-size: 14.5px !important;
                    line-height: 1.6 !important;
                }
                .footer-table td {
                    display: block !important;
                    width: 100% !important;
                    text-align: left !important;
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                }
            }
        </style>
    </head>
    <body bgcolor="#ffffff" style="margin: 0; padding: 0; width: 100% !important; min-width: 100%; background-color: #ffffff; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; text-align: left;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#ffffff" class="email-full-wrapper" style="width: 100%; max-width: 100%; border-collapse: collapse; margin: 0; padding: 0; background-color: #ffffff; text-align: left;">
            <tr>
                <td align="left" valign="top" class="email-main-body" style="padding: 24px 28px 24px 28px; margin: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.65; color: #334155; text-align: left; word-break: break-word; overflow-wrap: break-word;">
                    <!-- Email Content directly in body without box/card container -->
                    ${cleanHtml}

                    <!-- Seamless Footer Section (Logo with Address below it on the Left) -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="footer-table" style="width: 100%; border-collapse: collapse; margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <tr>
                            <td align="left" valign="top" style="padding-top: 18px; text-align: left; vertical-align: top; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                                <img src="${logoUrl}" alt="AIVES Australia Testprep" width="70" height="70" border="0" style="width: 70px; max-width: 70px; height: 70px; max-height: 70px; object-fit: contain; border: 0; outline: none; display: block; margin-bottom: 10px;" />
                                <div style="font-size: 12px; line-height: 1.5; color: #475569; text-align: left;">
                                    <strong style="color: #0f172a; font-weight: 700; font-size: 12.5px;">AIVES Australia Testprep</strong><br/>
                                    Address: 2nd Floor, Geo Centre, Door No. 45, 1920 B3,<br/>
                                    NH-66, Chakkaraparambu, Vennala, Ernakulam, Kerala 682032
                                    <p style="margin: 4px 0 0 0; color: #64748b; font-size: 11px; text-align: left;">&copy; ${year} Aives Australia Test Prep. All rights reserved.</p>
                                </div>
                            </td>
                        </tr>
                        ${hasEnquiryDisclaimer ? `
                        <tr>
                            <td align="left" class="footer-disclaimer-cell" style="padding-top: 14px; text-align: left;">
                                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11.5px; color: #64748b; font-style: italic; line-height: 1.45;">
                                    This is an automated enquiry verification email generated by Aives Australia's TESTPREP CRM
                                </p>
                            </td>
                        </tr>` : ''}
                    </table>
                </td>
            </tr>
        </table>
    </body>
</html>`;

        console.log(`>>> Sending email TO: [${to}] | FROM: [${finalSenderEmail}] | SUBJECT: [${subject}]`);

        const plainTextBody = htmlToPlainText(cleanHtml);
        const plainTextFooter = `\n\n---\nAIVES Australia Testprep\nAddress: 2nd Floor, Geo Centre, Door No. 45, 1920 B3, NH-66, Chakkaraparambu, Vennala, Ernakulam, Kerala 682032\n© ${year} Aives Australia Test Prep. All rights reserved.`;
        const fullPlainText = plainTextBody ? (plainTextBody + plainTextFooter) : '';

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
            textContent: fullPlainText || undefined,
            headers: {
                'X-Mailer': 'AIVES-TESTPREP-CRM',
                'X-Auto-Response-Suppress': 'OOF, AutoReply',
                'X-Priority': '3',
                'Importance': 'Normal'
            },
            tags: ['transactional', 'lead-welcome'],
            replyTo: {
                name: finalSenderName,
                email: finalSenderEmail
            }
        };

        const finalAttachments = [];

        if (attachments && Array.isArray(attachments) && attachments.length > 0) {
            // Strictly exclude any logo files so the logo is NEVER sent as a file attachment
            const cleanAttachments = attachments.filter(att => {
                if (!att) return false;
                const name = String(att.name || att.filename || '').toLowerCase().trim();
                return !name.includes('logo') && !name.includes('aiveslogo');
            });
            finalAttachments.push(...cleanAttachments);
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

