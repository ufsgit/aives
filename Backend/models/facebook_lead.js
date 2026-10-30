const { executeTransaction, getmultipleSP } = require('../helpers/sp-caller');

const facebook_lead = {

    // Save (Insert / Update) a Facebook Lead
    Save_Facebook_Lead: async function (data) {
        return executeTransaction('Save_Facebook_Lead', [
            data.Lead_ID   || 0,
            data.name      || '',
            data.phone     || '',
            data.location  || '',
            data.model     || '',
            data.date      || null
        ]);
    },

    // Search / List Facebook Leads
    Search_Facebook_Lead: async function (searchTerm) {
        if (searchTerm === undefined || searchTerm === 'undefined')
            searchTerm = '';
        return getmultipleSP('Search_Facebook_Lead', [searchTerm]);
    },

    // Delete a Facebook Lead by ID
    Delete_Facebook_Lead: async function (leadId) {
        return executeTransaction('Delete_Facebook_Lead', [leadId]);
    }
};

module.exports = facebook_lead;
