const express = require('express');
const router = express.Router();
const email_template = require('../models/email_template');

router.post('/Save_Email_Template', async (req, res) => {
    try {
        const rows = await email_template.Save_Email_Template(req.body);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to save email template', error: e.message });
    }
});

router.get('/Search_Email_Template', async (req, res) => {
    try {
        const rows = await email_template.Search_Email_Template(req.query.searchTerm);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to search email templates', error: e.message });
    }
});

router.get('/Get_Email_Template/:id', async (req, res) => {
    try {
        const rows = await email_template.Get_Email_Template(req.params.id);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to get email template', error: e.message });
    }
});

router.get('/Delete_Email_Template/:id', async (req, res) => {
    try {
        const rows = await email_template.Delete_Email_Template(req.params.id);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to delete email template', error: e.message });
    }
});

const emailHelper = require('../helpers/email-helper');

router.post('/Send_Email_With_Template', async (req, res) => {
    try {
        const { Template_ID, To_Email, Placeholders, Sender_Email, Sender_Name, Attachments } = req.body;
        const effectiveSenderEmail = Sender_Email || req.userEmail || null;
        const effectiveSenderName = Sender_Name || req.userName || null;
        console.log('Send_Email_With_Template request:', { Template_ID, To_Email, Placeholders, effectiveSenderEmail, effectiveSenderName, hasAttachments: !!(Attachments && Attachments.length) });
        
        // 1. Get the template
        const templates = await email_template.Get_Email_Template(Template_ID);
        console.log('Template query result:', templates);

        if (!templates || templates.length === 0) {
            console.error('Template not found');
            return res.status(404).json({ success: false, message: 'Template not found' });
        }

        const template = templates[0];

        // Check if the template is active before sending
        // Only send if Is_Active is explicitly 1; treat 0, null, or undefined as inactive
        if (parseInt(template.Is_Active) !== 1) {
            console.log(`Template ID ${Template_ID} is inactive (Is_Active=${template.Is_Active}). Skipping email send.`);
            return res.json({ success: true, skipped: true, message: 'Template is inactive. Email not sent.' });
        }

        let body = template.Body;
        let subject = template.Subject;

        // 2. Replace placeholders if any
        if (Placeholders) {
            Object.keys(Placeholders).forEach(key => {
                const regex = new RegExp(`\\[${key}\\]`, 'g');
                if (body) body = body.replace(regex, Placeholders[key]);
                if (subject) subject = subject.replace(regex, Placeholders[key]);
            });
        }

        // 3. Send email
        console.log('Attempting to send email to:', To_Email);
        const htmlBody = body ? body.replace(/\n/g, '<br>') : '';
        await emailHelper.sendEmail(To_Email, subject, htmlBody, effectiveSenderEmail, effectiveSenderName, Attachments);
        console.log('Email sent successfully');

        res.json({ success: true, message: 'Email sent successfully' });
    } catch (e) {
        console.error('Error sending template email:', e.message);
        let detailedError = e.message;
        if (e.responseData) {
            console.error('Brevo API Error Data:', e.responseData);
            detailedError = typeof e.responseData === 'string' ? e.responseData : JSON.stringify(e.responseData);
        }
        res.status(500).json({ success: false, message: 'Failed to send email', error: detailedError });
    }
});

module.exports = router;
