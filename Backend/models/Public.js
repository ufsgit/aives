const {executeTransaction} = require('../helpers/sp-caller');


const Public = {
    
    Get_All_Menu: async function() {
        console.log('executeTransaction: ',);
        return executeTransaction('Get_All_Menu', [ ]);
    },
    Get_All_Menu_Permission : async function() {
        console.log('executeTransaction: ',);
        return executeTransaction('Get_All_Menu_Permission', [ ]);
    },

    Check_App_Version: async function(version) {
        return executeTransaction('Check_App_Version', [ version]);
    },
    deactivate_Account: async function(details) {
        console.log('details: ', details);
        return executeTransaction('deactivate_Account', [ details.mobileNumber]);
    },
}
module.exports = Public;