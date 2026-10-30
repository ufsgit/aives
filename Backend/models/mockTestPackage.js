const { executeTransaction, getmultipleSP } = require("../helpers/sp-caller");

const MockTestPackage = {
    Save_MockTestPackage: async (data) => {
        const result = await executeTransaction("Save_MockTestPackage", [
            data.Package_ID || 0,
            data.Package_Name
        ]);
        return result;
    },
    Get_MockTestPackages: async () => {
        const result = await getmultipleSP("Get_MockTestPackages", []);
        return result;
    },
    Delete_MockTestPackage: async (id) => {
        const result = await executeTransaction("Delete_MockTestPackage", [id]);
        return result;
    }
};

module.exports = MockTestPackage;
