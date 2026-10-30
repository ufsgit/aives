const { executeTransaction } = require('../helpers/sp-caller');

const campaign = {
    Save_Campaign: async function (campaignData) {
        return executeTransaction('Save_Campaign', [
            campaignData.Campaign_ID || 0,
            campaignData.Campaign_Name || '',
            campaignData.Campaign_Number || '',
            campaignData.Lead_Source_Type || '',
            campaignData.FB_Page_ID || '',
            campaignData.FB_Page_AccessToken || '',
            campaignData.FB_Form_ID || '',
            JSON.stringify(campaignData.User_IDs || [])
        ]);
    },
    Delete_Campaign: async function (campaignId) {
        return executeTransaction('Delete_Campaign', [campaignId]);
    },
    Search_Campaign: async function (campaignName) {
        if (campaignName === undefined || campaignName === 'undefined')
            campaignName = '';
        return executeTransaction('Search_Campaign', [campaignName]);
    }
};

module.exports = campaign;
