const { getmultipleSP } = require("../helpers/sp-caller");

const Reports = {
  Get_UserList: async () => {
    try {
      const [rows] = await getmultipleSP("Get_UserList", []);
      return rows;
    } catch (error) {
      console.error("Error in Get_UserList:", error);
      throw new Error("Internal server error");
    }
  },
  // services/Reports.js or models/Reports.js

Search_Receipts_and_Expense: async (params) => {
  const {
    User_Id = null,
    Account_Id = null,
    Type = null,
    FromDate = null,
    ToDate = null,
    Account_Name = null
  } = params;
  console.log("Search_Receipts_and_Expense called with params:", params);
  
  const rows = await getmultipleSP('Search_Receipts_and_Expense', [
    User_Id,
    Account_Name,
    Type,
    FromDate,
    ToDate
  ]);
  
  return rows;
},
};

module.exports = Reports;
