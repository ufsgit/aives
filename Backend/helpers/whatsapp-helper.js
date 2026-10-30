const axios = require('axios');

async function sendWhatsAppMessage(phone, studentName, date, courseName, batchName) {
    if (!phone) return;

    // Clean phone number: remove non-digits and ensure country code
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone; // Default to India if 10 digits
    }

    const url = `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    
    const data = {
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "template",
        template: {
            name: "absent_notification", // Replace with your approved template name
            language: {
                code: "en_US"
            },
            components: [
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: studentName },
                        { type: "text", text: date },
                        { type: "text", text: courseName },
                        { type: "text", text: batchName }
                    ]
                }
            ]
        }
    };

    try {
        const response = await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`WhatsApp sent to ${cleanPhone}:`, response.data);
        return response.data;
    } catch (error) {
        console.error(`WhatsApp Error for ${cleanPhone}:`, error.response ? error.response.data : error.message);
        throw error;
    }
}

module.exports = { sendWhatsAppMessage };
